import assert from "node:assert/strict";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import test from "node:test";
import { appendEvent, compactJournal, readJournal } from "../src/core/journal.js";
import { context } from "./helpers.js";

test("journal stores launch metadata and drops unknown fields on read", async () => {
  const ctx = await context();
  await appendEvent(ctx.paths, { type: "launch", id: "one", at: "2026-11-03T04:00:00.000Z", day: "2026-11-03", kind: "run", model: null });
  await appendFile(ctx.paths.journalFile, JSON.stringify({ type: "reset", id: "two", at: "2026-11-03T04:01:00.000Z", day: "2026-11-03", prompt: "never keep this" }) + "\n");
  const events = await readJournal(ctx.paths);
  assert.equal(events.length, 2);
  assert.equal("prompt" in events[1]!, false);
});

test("corrupt journals fail closed instead of resetting budgets", async () => {
  const ctx = await context();
  await mkdir(ctx.paths.stateDir, { recursive: true });
  await writeFile(ctx.paths.journalFile, "not json\n");
  await assert.rejects(readJournal(ctx.paths), /line 1 is invalid/);
});

test("compaction bounds older history but keeps all current-day records", async () => {
  const ctx = await context();
  for (let index = 0; index < 5; index += 1) {
    await appendEvent(ctx.paths, { type: "launch", id: `old-${index}`, at: "2026-11-02T04:00:00.000Z", day: "2026-11-02", kind: "run", model: null });
  }
  await appendEvent(ctx.paths, { type: "launch", id: "today", at: "2026-11-03T04:00:00.000Z", day: "2026-11-03", kind: "run", model: null });
  assert.equal(await compactJournal(ctx.paths, "2026-11-03", 2), 3);
  const events = await readJournal(ctx.paths);
  assert.equal(events.length, 3);
  assert.ok(events.some((event) => event.id === "today"));
});
