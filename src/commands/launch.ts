import { budgetWarning, recordFinish, reserveLaunch } from "../core/budget.js";
import { databaseEnv, resolveDatabase, type DatabaseDecision } from "../core/database.js";
import { errorMessage } from "../core/errors.js";
import { ensureOpenCode } from "../core/install.js";
import { runInherited } from "../core/process.js";
import type { AppContext, Channel, LaunchKind, NullxConfig } from "../core/types.js";
import { modelValue } from "../core/validation.js";
import { hasModelFlag, isHelpOrVersion, modelFromArgs } from "../utils/args.js";
import { withConnectionAnimation } from "../ui/connection-animation.js";

export type InheritedRunner = typeof runInherited;

function channelOf(version: string, fallback: Channel): Channel {
  return Number(version.split(".")[0]) >= 2 ? "v2" : Number(version.split(".")[0]) === 1 ? "v1" : fallback;
}

export async function launchCommand(
  ctx: AppContext,
  config: NullxConfig,
  kind: LaunchKind,
  args: readonly string[],
  runner: InheritedRunner = runInherited,
): Promise<number> {
  const helpOrVersion = isHelpOrVersion(args);
  let decision: DatabaseDecision | undefined;
  const binary = helpOrVersion
    ? await ensureOpenCode(ctx, config)
    : await withConnectionAnimation(async (phase) => {
        const resolved = await ensureOpenCode(ctx, config, phase);
        // Preflight the schema so a v1 binary never dies on a v2 database.
        phase("Checking the OpenCode database schema");
        decision = await resolveDatabase(ctx, config, channelOf(resolved.version, config.channel));
        if (decision.isolated) phase(`Using a separate ${channelOf(resolved.version, config.channel)} database`);
        return resolved;
      }, { stream: ctx.stderr, env: ctx.env });

  if (decision && !helpOrVersion) {
    if (decision.isolated) {
      ctx.stderr.write(`note: ${decision.reason}\n`);
      if (decision.suggestion) ctx.stderr.write(`      ${decision.suggestion}\n`);
    }
    if (!decision.compatible) {
      ctx.stderr.write(`error: ${decision.reason}\n`);
      if (decision.suggestion) ctx.stderr.write(`       ${decision.suggestion}\n`);
      return 3;
    }
  }
  const launchEnv = decision ? databaseEnv(ctx, decision) : ctx.env;

  const upstreamArgs = (forwarded: readonly string[]): string[] => kind === "run" ? ["run", ...forwarded] : [...forwarded];
  let forwarded = [...args];
  if (!hasModelFlag(forwarded) && config.defaultModel) forwarded = ["--model", config.defaultModel, ...forwarded];
  if (helpOrVersion) {
    return (await runner(binary.file, upstreamArgs(forwarded), { cwd: ctx.cwd, env: ctx.env })).exitCode;
  }
  const explicitModel = modelFromArgs(forwarded);
  const model = explicitModel === undefined ? config.defaultModel : modelValue(explicitModel);
  const reservation = await reserveLaunch(ctx, config, kind, model);
  const warning = budgetWarning(reservation.snapshot, kind);
  if (warning) ctx.stderr.write(`${warning}\n`);
  const started = Date.now();
  let exitCode = 127;
  let signal: NodeJS.Signals | null = null;
  try {
    const result = await runner(binary.file, upstreamArgs(forwarded), { cwd: ctx.cwd, env: launchEnv });
    exitCode = result.exitCode;
    signal = result.signal;
    return exitCode;
  } finally {
    try {
      await recordFinish(ctx, config, reservation.event, exitCode, signal, Math.max(0, Date.now() - started));
    } catch (error) {
      ctx.stderr.write(`OpenCode finished, but the local journal could not record completion: ${errorMessage(error)}\n`);
    }
  }
}
