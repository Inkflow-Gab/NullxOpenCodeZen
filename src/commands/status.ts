import { budgetSnapshot } from "../core/budget.js";
import { loadConfig } from "../core/config.js";
import { detectOpenCode } from "../core/detect.js";
import { readJournal } from "../core/journal.js";
import type { AppContext, BudgetSnapshot } from "../core/types.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { meter, paint, writeJson, writeLine } from "../ui/terminal.js";

export function renderBudget(ctx: AppContext, snapshot: BudgetSnapshot): void {
  writeLine(ctx, `Local day ${snapshot.day} (${snapshot.timezone}); resets ${snapshot.resetsAt}`);
  writeLine(ctx, `Runs     ${String(snapshot.runs).padStart(5)} / ${snapshot.runLimit ?? "unlimited"} ${meter(snapshot.runs, snapshot.runLimit)}`);
  writeLine(ctx, `Sessions ${String(snapshot.sessions).padStart(5)} / ${snapshot.sessionLimit ?? "unlimited"} ${meter(snapshot.sessions, snapshot.sessionLimit)}`);
  writeLine(ctx, `Finished: ${snapshot.completed} successful, ${snapshot.failed} nonzero/signal exits`);
}

export async function statusCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const parsed = parseFlags(args, [{ names: ["--json"], takesValue: false }]);
  rejectPositionals(parsed);
  const config = await loadConfig(ctx);
  const binary = await detectOpenCode(ctx, config);
  const snapshot = await budgetSnapshot(ctx, config);
  const recent = (await readJournal(ctx.paths)).slice(-5);
  if (json || parsed.flags.has("--json")) {
    writeJson(ctx, { config, binary, budget: snapshot, recent });
    return 0;
  }
  writeLine(ctx, paint(ctx, "Nullx OpenCode Zen", 35));
  writeLine(ctx, binary ? `OpenCode ${binary.version} · ${binary.source} · ${binary.file}` : "OpenCode: not installed (nullx install)");
  writeLine(ctx, `Default model: ${config.defaultModel ?? "OpenCode's own selection"}`);
  writeLine(ctx, `Install channel: ${config.channel}; auto-install: ${config.autoInstall ? "on" : "off"}`);
  writeLine(ctx);
  renderBudget(ctx, snapshot);
  writeLine(ctx);
  writeLine(ctx, "These are local launch counters, not Zen account quota or token balances.");
  writeLine(ctx, "Use nullx stats for OpenCode's own usage statistics.");
  if (recent.length) {
    writeLine(ctx);
    writeLine(ctx, "Recent local events:");
    for (const event of recent) writeLine(ctx, `  ${event.at} ${event.type}${event.type === "launch" ? `:${event.kind}` : ""}`);
  }
  return 0;
}
