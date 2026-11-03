import { ensureOpenCode } from "../core/install.js";
import { runInherited } from "../core/process.js";
import type { AppContext, NullxConfig } from "../core/types.js";

export async function upstreamCommand(
  ctx: AppContext,
  config: NullxConfig,
  command: "auth" | "models" | "stats",
  args: readonly string[],
): Promise<number> {
  const binary = await ensureOpenCode(ctx, config);
  const forwarded = command === "auth" && args.length === 0 ? ["login"] : [...args];
  return (await runInherited(binary.file, [command, ...forwarded], { cwd: ctx.cwd, env: ctx.env })).exitCode;
}
