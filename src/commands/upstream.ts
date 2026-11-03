import { ensureOpenCode } from "../core/install.js";
import { runInherited } from "../core/process.js";
import type { AppContext, NullxConfig } from "../core/types.js";
import { withConnectionAnimation } from "../ui/connection-animation.js";
import { isHelpOrVersion } from "../utils/args.js";

export async function upstreamCommand(
  ctx: AppContext,
  config: NullxConfig,
  command: "auth" | "models" | "stats",
  args: readonly string[],
): Promise<number> {
  const binary = isHelpOrVersion(args)
    ? await ensureOpenCode(ctx, config)
    : await withConnectionAnimation((phase) => ensureOpenCode(ctx, config, phase), {
      stream: ctx.stderr,
      env: ctx.env,
      title: `Preparing OpenCode ${command} for OpenCode Zen`,
    });
  const forwarded = command === "auth" && args.length === 0 ? ["login"] : [...args];
  return (await runInherited(binary.file, [command, ...forwarded], { cwd: ctx.cwd, env: ctx.env })).exitCode;
}
