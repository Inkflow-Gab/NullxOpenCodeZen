import { readJournal } from "../core/journal.js";
import { integerValue } from "../core/validation.js";
import type { AppContext } from "../core/types.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { writeJson, writeLine } from "../ui/terminal.js";

export async function historyCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const parsed = parseFlags(args, [{ names: ["--limit"], takesValue: true }, { names: ["--json"], takesValue: false }]);
  rejectPositionals(parsed);
  const limit = integerValue(Number(parsed.values.get("--limit") ?? "20"), "limit", 1, 10_000);
  const events = (await readJournal(ctx.paths)).slice(-limit);
  if (json || parsed.flags.has("--json")) { writeJson(ctx, events); return 0; }
  if (!events.length) { writeLine(ctx, "No local launches recorded yet."); return 0; }
  for (const event of events) {
    if (event.type === "launch") writeLine(ctx, `${event.at}  start ${event.kind.padEnd(7)} ${event.model ?? "default model"}  ${event.id}`);
    else if (event.type === "finish") writeLine(ctx, `${event.at}  finish exit=${event.exitCode}${event.signal ? ` signal=${event.signal}` : ""} ${event.durationMs}ms  ${event.id}`);
    else writeLine(ctx, `${event.at}  local budget reset  ${event.id}`);
  }
  return 0;
}
