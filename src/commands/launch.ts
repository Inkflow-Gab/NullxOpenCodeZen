import { budgetWarning, recordFinish, reserveLaunch } from "../core/budget.js";
import { errorMessage } from "../core/errors.js";
import { ensureOpenCode } from "../core/install.js";
import { runInherited } from "../core/process.js";
import type { AppContext, LaunchKind, NullxConfig } from "../core/types.js";
import { modelValue } from "../core/validation.js";
import { hasModelFlag, isHelpOrVersion, modelFromArgs } from "../utils/args.js";

export type InheritedRunner = typeof runInherited;

export async function launchCommand(
  ctx: AppContext,
  config: NullxConfig,
  kind: LaunchKind,
  args: readonly string[],
  runner: InheritedRunner = runInherited,
): Promise<number> {
  const binary = await ensureOpenCode(ctx, config);
  const upstreamArgs = (forwarded: readonly string[]): string[] => kind === "run" ? ["run", ...forwarded] : [...forwarded];
  let forwarded = [...args];
  if (!hasModelFlag(forwarded) && config.defaultModel) forwarded = ["--model", config.defaultModel, ...forwarded];
  if (isHelpOrVersion(args)) {
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
    const result = await runner(binary.file, upstreamArgs(forwarded), { cwd: ctx.cwd, env: ctx.env });
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
