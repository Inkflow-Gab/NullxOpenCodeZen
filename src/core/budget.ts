import { randomUUID } from "node:crypto";
import { dayKey, nextReset } from "./clock.js";
import { AppError, EXIT } from "./errors.js";
import { appendEvent, compactJournal, readJournal } from "./journal.js";
import { withLock } from "./lock.js";
import type { AppContext, BudgetSnapshot, JournalEvent, LaunchEvent, LaunchKind, NullxConfig } from "./types.js";

export function summarize(events: readonly JournalEvent[], day: string, config: NullxConfig, now: Date): BudgetSnapshot {
  let runs = 0;
  let sessions = 0;
  let completed = 0;
  let failed = 0;
  const active = new Set<string>();
  const seen = new Set<string>();
  for (const event of events) {
    if (event.day !== day) continue;
    if (event.type === "reset") {
      runs = 0;
      sessions = 0;
      completed = 0;
      failed = 0;
      active.clear();
      continue;
    }
    if (event.type === "launch") {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      active.add(event.id);
      if (event.kind === "run") runs += 1;
      else sessions += 1;
      continue;
    }
    if (active.has(event.id)) {
      active.delete(event.id);
      if (event.exitCode === 0) completed += 1;
      else failed += 1;
    }
  }
  const remaining = (used: number, limit: number | null): number | null => limit === null ? null : Math.max(0, limit - used);
  return {
    day,
    timezone: config.timezone,
    resetsAt: nextReset(now, config.timezone).toISOString(),
    runs,
    sessions,
    runLimit: config.budget.runsPerDay,
    sessionLimit: config.budget.sessionsPerDay,
    runsRemaining: remaining(runs, config.budget.runsPerDay),
    sessionsRemaining: remaining(sessions, config.budget.sessionsPerDay),
    completed,
    failed,
    warnAtPercent: config.budget.warnAtPercent,
  };
}

export async function budgetSnapshot(ctx: AppContext, config: NullxConfig): Promise<BudgetSnapshot> {
  const now = ctx.now();
  return summarize(await readJournal(ctx.paths), dayKey(now, config.timezone), config, now);
}

export function budgetBlock(snapshot: BudgetSnapshot, kind: LaunchKind): string | null {
  if (kind === "run" && snapshot.runLimit !== null && snapshot.runs >= snapshot.runLimit) {
    return `Local daily run budget reached (${snapshot.runs}/${snapshot.runLimit}). Resets at ${snapshot.resetsAt}.`;
  }
  if (kind === "session" && snapshot.sessionLimit !== null && snapshot.sessions >= snapshot.sessionLimit) {
    return `Local daily session budget reached (${snapshot.sessions}/${snapshot.sessionLimit}). Resets at ${snapshot.resetsAt}.`;
  }
  return null;
}

export function budgetWarning(snapshot: BudgetSnapshot, kind: LaunchKind): string | null {
  const used = kind === "run" ? snapshot.runs : snapshot.sessions;
  const limit = kind === "run" ? snapshot.runLimit : snapshot.sessionLimit;
  if (limit === null || limit === 0) return null;
  const percent = Math.floor((used / limit) * 100);
  return percent >= snapshot.warnAtPercent ? `Local ${kind} budget is at ${percent}% (${used}/${limit}).` : null;
}

export async function reserveLaunch(
  ctx: AppContext,
  config: NullxConfig,
  kind: LaunchKind,
  model: string | null,
): Promise<{ event: LaunchEvent; snapshot: BudgetSnapshot }> {
  return withLock(ctx.paths.journalLock, async () => {
    const now = ctx.now();
    const day = dayKey(now, config.timezone);
    const events = await readJournal(ctx.paths);
    const before = summarize(events, day, config, now);
    const blocked = budgetBlock(before, kind);
    if (blocked) throw new AppError("BUDGET_EXCEEDED", blocked, EXIT.BUDGET, { snapshot: before });
    const event: LaunchEvent = { type: "launch", id: randomUUID(), at: now.toISOString(), day, kind, model };
    // Persist the reservation before starting a process that may consume provider quota.
    await appendEvent(ctx.paths, event);
    await compactJournal(ctx.paths, day, config.historyLimit);
    return { event, snapshot: summarize([...events, event], day, config, now) };
  });
}

export async function recordFinish(
  ctx: AppContext,
  config: NullxConfig,
  launch: LaunchEvent,
  exitCode: number,
  signal: NodeJS.Signals | null,
  durationMs: number,
): Promise<void> {
  await withLock(ctx.paths.journalLock, async () => {
    const now = ctx.now();
    const day = dayKey(now, config.timezone);
    await appendEvent(ctx.paths, { type: "finish", id: launch.id, at: now.toISOString(), day, exitCode, signal, durationMs });
    await compactJournal(ctx.paths, day, config.historyLimit);
  });
}

export async function resetToday(ctx: AppContext, config: NullxConfig): Promise<BudgetSnapshot> {
  return withLock(ctx.paths.journalLock, async () => {
    const now = ctx.now();
    const day = dayKey(now, config.timezone);
    await appendEvent(ctx.paths, { type: "reset", id: randomUUID(), at: now.toISOString(), day });
    return summarize(await readJournal(ctx.paths), day, config, now);
  });
}
