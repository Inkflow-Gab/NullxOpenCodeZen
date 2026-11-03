import { loadConfig } from "../core/config.js";
import { usage } from "../core/errors.js";
import { installOpenCode } from "../core/install.js";
import type { AppContext, Channel } from "../core/types.js";
import { channelValue } from "../core/validation.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { writeJson, writeLine } from "../ui/terminal.js";

export async function installCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const parsed = parseFlags(args, [
    { names: ["--channel"], takesValue: true },
    { names: ["--version"], takesValue: true },
    { names: ["--force"], takesValue: false },
    { names: ["--dry-run"], takesValue: false },
    { names: ["--json"], takesValue: false },
  ]);
  rejectPositionals(parsed);
  if (parsed.forwarded.length) throw usage("install does not forward arguments");
  const config = await loadConfig(ctx);
  const channelInput = parsed.values.get("--channel");
  const channel: Channel | undefined = channelInput === undefined ? undefined : channelValue(channelInput);
  const result = await installOpenCode(ctx, config, {
    ...(channel ? { channel } : {}),
    ...(parsed.values.has("--version") ? { version: parsed.values.get("--version")! } : {}),
    force: parsed.flags.has("--force"),
    dryRun: parsed.flags.has("--dry-run"),
  });
  if (json || parsed.flags.has("--json")) { writeJson(ctx, result); return 0; }
  if (result.status === "already-installed") {
    writeLine(ctx, `OpenCode ${result.binary.version} is already available (${result.binary.source}).`);
    writeLine(ctx, result.binary.file);
  } else if (result.status === "planned") {
    writeLine(ctx, `Would install ${result.plan.packageSpec} from ${result.plan.registry}`);
    writeLine(ctx, `Target: ${result.plan.targetDirectory}`);
    writeLine(ctx, `Binary: ${result.plan.binaryPath}`);
  } else {
    writeLine(ctx, `Installed OpenCode ${result.binary.version} (${result.receipt.channel}).`);
    writeLine(ctx, result.receipt.binaryPath);
    writeLine(ctx, `SHA-512: ${result.receipt.integrity}`);
    if (ctx.env.NULLX_OPENCODE_BINARY || config.binaryPath) {
      writeLine(ctx, "An explicit binary override is still active; unset it to use the managed install.");
    }
    writeLine(ctx, "Next: nullx auth login, then nullx models and nullx model set <provider/model>.");
  }
  return 0;
}
