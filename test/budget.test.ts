import assert from "node:assert/strict";
import test from "node:test";
import { budgetBlock, budgetSnapshot, recordFinish, reserveLaunch, resetToday, summarize } from "../src/core/budget.js";
import { defaultConfig } from "../src/core/config.js";
import { readJournal } from "../src/core/journal.js";
import { context } from "./helpers.js";

test("budget blocks at the limit and distinguishes runs from sessions", async () => {
  const ctx = await context();
  const config = { ...defaultConfig(), timezone: "UTC", budget: { runsPerDay: 1, sessionsPerDay: 1, warnAtPercent: 80 } };
  const run = await reserveLaunch(ctx, config, "run", null);
  assert.equal(run.snapshot.runs, 1);
  assert.match(budgetBlock(run.snapshot, "run") ?? "", /budget reached/);
  assert.equal(budgetBlock(run.snapshot, "session"), null);
  await assert.rejects(reserveLaunch(ctx, config, "run", null), /budget reached/);
  await recordFinish(ctx, config, run.event, 0, null, 12);
  const snapshot = await budgetSnapshot(ctx, config);
  assert.equal(snapshot.completed, 1);
});

test("concurrent reservations cannot oversubscribe a local limit", async () => {
  const ctx = await context();
  const config = { ...defaultConfig(), timezone: "UTC", budget: { runsPerDay: 5, sessionsPerDay: null, warnAtPercent: 80 } };
  const results = await Promise.allSettled(Array.from({ length: 15 }, () => reserveLaunch(ctx, config, "run", null)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
  assert.equal((await budgetSnapshot(ctx, config)).runs, 5);
});

test("explicit reset preserves journal history and clears today's counters", async () => {
  const ctx = await context();
  const config = { ...defaultConfig(), timezone: "UTC" };
  await reserveLaunch(ctx, config, "run", null);
  const snapshot = await resetToday(ctx, config);
  assert.equal(snapshot.runs, 0);
  assert.equal((await readJournal(ctx.paths)).length, 2);
});

test("midnight rollover does not require a reset event", () => {
  const config = { ...defaultConfig(), timezone: "Asia/Manila" };
  const events = [{ type: "launch" as const, id: "old", at: "2026-11-03T15:00:00.000Z", day: "2026-11-03", kind: "run" as const, model: null }];
  const snapshot = summarize(events, "2026-11-04", config, new Date("2026-11-03T16:00:00.000Z"));
  assert.equal(snapshot.runs, 0);
});
