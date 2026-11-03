import type { AppContext } from "../core/types.js";
import { usage } from "../core/errors.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { loadAscii, loadFittingAscii, renderAscii } from "../ui/banner.js";
import { writeLine } from "../ui/terminal.js";

export async function mascotCommand(ctx: AppContext, args: readonly string[]): Promise<number> {
  const parsed = parseFlags(args, [
    { names: ["--large"], takesValue: false },
    { names: ["--compact"], takesValue: false },
  ]);
  rejectPositionals(parsed);
  if (parsed.flags.has("--large") && parsed.flags.has("--compact")) throw usage("Choose either --large or --compact, not both");
  const explicit = parsed.flags.has("--compact") || parsed.flags.has("--large");
  const columns = (ctx.stdout as { columns?: number }).columns ?? (Number(ctx.env.COLUMNS) || 80);
  const ascii = explicit
    ? await loadAscii(parsed.flags.has("--compact") ? "compact" : "large")
    : await loadFittingAscii(columns);
  writeLine(ctx, renderAscii(ctx, ascii));
  if (ascii.length > 0) writeLine(ctx, renderAscii(ctx, await loadAscii("wordmark")));
  return 0;
}
