import { loadFittingAscii } from "../ui/banner.js";
import { SetupProgress } from "../ui/progress.js";
import { gradient, writeJson } from "../ui/terminal.js";
import { loadConfig, saveConfig } from "../core/config.js";
import { inspectOpenCode, readReceipt } from "../core/detect.js";
import { describeEnvironment, environmentLabel } from "../core/environment.js";
import { AppError, EXIT, errorMessage } from "../core/errors.js";
import { ensureOpenCode, installOpenCode } from "../core/install.js";
import { defaultBinDir, findCommandConflict, installLauncher, type LauncherResult } from "../core/launcher.js";
import type { AppContext, Channel, DetectedBinary } from "../core/types.js";
import { channelValue, integerValue } from "../core/validation.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";

export interface SetupResult {
  ok: boolean;
  command: string;
  launcher: LauncherResult;
  binary: DetectedBinary | null;
  environment: string;
  nextSteps: string[];
  warnings: string[];
}

export async function setupCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const parsed = parseFlags(args, [
    { names: ["--name"], takesValue: true },
    { names: ["--bin-dir"], takesValue: true },
    { names: ["--channel"], takesValue: true },
    { names: ["--retries"], takesValue: true },
    { names: ["--force"], takesValue: false },
    { names: ["--repair"], takesValue: false },
    { names: ["--skip-opencode"], takesValue: false },
    { names: ["--no-path"], takesValue: false },
    { names: ["--json"], takesValue: false },
  ]);
  rejectPositionals(parsed);
  if (parsed.forwarded.length) throw new AppError("USAGE", "setup does not forward arguments", EXIT.USAGE);

  const useJson = json || parsed.flags.has("--json");
  const channelInput = parsed.values.get("--channel");
  const channel: Channel | undefined = channelInput === undefined ? undefined : channelValue(channelInput);
  const retriesInput = parsed.values.get("--retries");
  const retries = retriesInput === undefined
    ? 2
    : integerValue(/^\d+$/.test(retriesInput) ? Number(retriesInput) : Number.NaN, "--retries", 0, 5);
  const skipOpencode = parsed.flags.has("--skip-opencode");
  const progress = new SetupProgress({
    stream: ctx.stderr,
    silent: useJson,
    env: ctx.env,
    total: 5,
    title: "Nullx OpenCode Zen · all-in-one setup",
  });

  const warnings: string[] = [];
  if (!useJson) await progress.banner(await loadFittingAscii(progress.columns()));

  try {
    const environment = await progress.step("Inspecting the environment", async () => {
      const info = await describeEnvironment({ env: ctx.env, platform: ctx.platform });
      const major = Number(process.versions.node.split(".")[0]);
      if (major < 22) {
        throw new AppError("NODE_TOO_OLD", `Node ${process.versions.node} is too old. Install Node 22 or newer, then rerun setup.`, EXIT.CONFIG);
      }
      for (const hint of info.hints) warnings.push(hint);
      return { value: info, note: environmentLabel(info) };
    });

    const config = await progress.step("Preparing configuration", async () => {
      const existing = await loadConfig(ctx);
      const next = channel ? { ...existing, channel } : existing;
      await saveConfig(ctx, next);
      return { value: next, note: `channel ${next.channel}` };
    });

    const launcher = await progress.step("Installing the nullx command", async (detail) => {
      detail(defaultBinDir(ctx));
      const result = await installLauncher(ctx, {
        ...(parsed.values.has("--name") ? { name: parsed.values.get("--name")! } : {}),
        ...(parsed.values.has("--bin-dir") ? { binDir: parsed.values.get("--bin-dir")! } : {}),
        force: parsed.flags.has("--force"),
        updatePath: !parsed.flags.has("--no-path"),
      });
      if (result.renamedFrom) {
        warnings.push(
          `Another program already owns "${result.renamedFrom}", so this project installed "${result.name}" instead. Both tools keep working.`,
        );
      }
      if (result.backup) warnings.push(`Backed up the previous command to ${result.backup}`);
      if (!result.pathAlreadyPresent) {
        warnings.push(`Open a new shell, or run: export PATH="${result.binDir}:$PATH"`);
      }
      return { value: result, note: `${result.action} ${result.file}` };
    });

    await progress.step("Checking command resolution", async () => {
      const found = await findCommandConflict(ctx, launcher.name);
      if (found && found.owner === "foreign") {
        warnings.push(`${found.file} still shadows "${launcher.name}" on PATH. Put ${launcher.binDir} first, or use the full path.`);
        return { value: found, note: "shadowed by another program" };
      }
      return { value: found, note: found ? found.file : "PATH updated for new shells" };
    });

    let binary: DetectedBinary | null = null;
    if (skipOpencode) {
      await progress.skip("Installing OpenCode", "--skip-opencode");
    } else {
      binary = await progress.step("Installing OpenCode", async (detail) => {
        const target = channel ?? config.channel;
        const repair = parsed.flags.has("--repair");
        detail(`official ${target} CLI from npm`);
        const installed = await installOpenCode(ctx, { ...config, channel: target }, {
          channel: target,
          repair,
          retries,
          progress: detail,
        });
        if (installed.status === "planned") {
          throw new AppError("INSTALL_FAILED", "Unexpected dry-run during setup", EXIT.INSTALL);
        }
        const resolved = await ensureOpenCode(ctx, await loadConfig(ctx), detail);
        return { value: resolved, note: `${resolved.version} (${resolved.source})` };
      });
    }

    if (!binary && !skipOpencode) {
      const report = await inspectOpenCode(ctx, config);
      binary = report.selected;
      warnings.push(...report.warnings);
    }
    const receipt = await readReceipt(ctx).catch(() => undefined);
    if (receipt && binary && binary.source !== "managed") {
      warnings.push(`A managed install exists, but ${binary.source} takes precedence. Unset the override to use the managed binary.`);
    }

    const nextSteps = [
      `${launcher.name} auth login`,
      `${launcher.name} models`,
      `${launcher.name} model set <provider/model>`,
      `${launcher.name} doctor --verbose`,
      `${launcher.name} start`,
    ];
    const result: SetupResult = {
      ok: true,
      command: launcher.name,
      launcher,
      binary,
      environment: environmentLabel(environment),
      nextSteps,
      warnings,
    };

    if (useJson) {
      writeJson(ctx, result);
      return 0;
    }

    await progress.finish([
      `Command: ${launcher.name} → ${launcher.file}`,
      binary ? `OpenCode: ${binary.version} (${binary.source})` : "OpenCode: not installed yet",
      "",
      "Next steps:",
      ...nextSteps.map((step) => `  ${step}`),
    ]);
    // Route trailing notes through the width-aware renderer so long paths
    // cannot wrap and scroll a narrow phone terminal.
    if (warnings.length) {
      await progress.line();
      await progress.line(gradient(ctx, "Notes"));
      for (const warning of warnings) await progress.line(`  • ${warning}`);
    }
    if (launcher.name !== "nullx") {
      await progress.line();
      await progress.line(`Use "${launcher.name}" for this project. The other "nullx" program is untouched.`);
      await progress.line(`To take over the name later: node dist/cli.js setup --name nullx --force`);
    }
    await progress.close();
    return 0;
  } catch (error) {
    await progress.abort("see the error above; fix it and rerun setup");
    if (useJson) {
      const appError = error instanceof AppError ? error : new AppError("SETUP_FAILED", errorMessage(error), EXIT.FAILURE);
      writeJson(ctx, { ok: false, error: { code: appError.code, message: appError.message }, warnings });
      return appError.exitCode;
    }
    throw error;
  }
}
