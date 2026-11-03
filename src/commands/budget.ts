import { budgetSnapshot, resetToday } from "../core/budget.js";
import { loadConfig, saveConfig } from "../core/config.js";
import { usage } from "../core/errors.js";
import type { AppContext } from "../core/types.js";
import { integerValue, parseLimit, timezoneValue } from "../core/validation.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { writeJson, writeLine } from "../ui/terminal.js";
import { renderBudget } from "./status.js";

export async function budgetCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const subcommand = args[0] && !args[0].startsWith("-") ? args[0] : "status";
  const rest = subcommand === args[0] ? args.slice(1) : args;
  const config = await loadConfig(ctx);
  if (subcommand === "status") {
    const parsed = parseFlags(rest, [{ names: ["--json"], takesValue: false }]);
    rejectPositionals(parsed);
    const snapshot = await budgetSnapshot(ctx, config);
    if (json || parsed.flags.has("--json")) writeJson(ctx, snapshot);
    else renderBudget(ctx, snapshot);
    return 0;
  }
  if (subcommand === "set") {
    const parsed = parseFlags(rest, [
      { names: ["--runs"], takesValue: true },
      { names: ["--sessions"], takesValue: true },
      { names: ["--warn-at"], takesValue: true },
      { names: ["--timezone"], takesValue: true },
      { names: ["--json"], takesValue: false },
    ]);
    rejectPositionals(parsed);
    if (parsed.values.size === 0) throw usage("budget set needs --runs, --sessions, --warn-at, or --timezone");
    if (parsed.values.has("--runs")) config.budget.runsPerDay = parseLimit(parsed.values.get("--runs")!, "runs");
    if (parsed.values.has("--sessions")) config.budget.sessionsPerDay = parseLimit(parsed.values.get("--sessions")!, "sessions");
    if (parsed.values.has("--warn-at")) config.budget.warnAtPercent = integerValue(Number(parsed.values.get("--warn-at")), "warn-at", 1, 100);
    if (parsed.values.has("--timezone")) config.timezone = timezoneValue(parsed.values.get("--timezone"));
    await saveConfig(ctx, config);
    const snapshot = await budgetSnapshot(ctx, config);
    if (json || parsed.flags.has("--json")) writeJson(ctx, snapshot);
    else { writeLine(ctx, "Local budget updated."); renderBudget(ctx, snapshot); }
    return 0;
  }
  if (subcommand === "reset") {
    const parsed = parseFlags(rest, [{ names: ["--yes"], takesValue: false }, { names: ["--json"], takesValue: false }]);
    rejectPositionals(parsed);
    if (!parsed.flags.has("--yes")) throw usage("budget reset clears today's local counters; pass --yes to confirm");
    const snapshot = await resetToday(ctx, config);
    if (json || parsed.flags.has("--json")) writeJson(ctx, snapshot);
    else { writeLine(ctx, "Today's local counters reset. History was preserved."); renderBudget(ctx, snapshot); }
    return 0;
  }
  throw usage(`Unknown budget command: ${subcommand}`);
}
