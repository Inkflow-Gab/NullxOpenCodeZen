import type { AppContext } from "../core/types.js";
import { usage } from "../core/errors.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { loadAscii, renderAscii } from "../ui/banner.js";
import { writeLine } from "../ui/terminal.js";

export async function mascotCommand(ctx: AppContext, args: readonly string[]): Promise<number> {
  const parsed = parseFlags(args, [
    { names: ["--large"], takesValue: false },
    { names: ["--compact"], takesValue: false },
  ]);
  rejectPositionals(parsed);
  if (parsed.flags.has("--large") && parsed.flags.has("--compact")) throw usage("Choose either --large or --compact, not both");
  const size = parsed.flags.has("--compact") ? "compact" : "large";
  const ascii = await loadAscii(size);
  writeLine(ctx, renderAscii(ctx, ascii));
  return 0;
}
