import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { launchCommand } from "../src/commands/launch.js";
import { defaultConfig } from "../src/core/config.js";
import { readJournal } from "../src/core/journal.js";
import { context, fakeBinary, okResult } from "./helpers.js";

async function launchContext() {
  const ctx = await context();
  const file = await fakeBinary(ctx.root);
  ctx.env.NULLX_OPENCODE_BINARY = file;
  ctx.exec = async () => ({ ...okResult, stdout: "1.19.5\n" });
  return ctx;
}

test("run injects the default model, records metadata only, and propagates exit code", async () => {
  const ctx = await launchContext();
  const config = { ...defaultConfig(), timezone: "UTC", defaultModel: "opencode/example" };
  const calls: string[][] = [];
  const exit = await launchCommand(ctx, config, "run", ["private prompt text"], async (_file, args) => {
    calls.push([...args]);
    return { exitCode: 7, signal: null };
  });
  assert.equal(exit, 7);
  assert.deepEqual(calls, [["run", "--model", "opencode/example", "private prompt text"]]);
  const journal = await readFile(ctx.paths.journalFile, "utf8");
  assert.equal(journal.includes("private prompt text"), false);
  const events = await readJournal(ctx.paths);
  assert.equal(events.length, 2);
  assert.equal(events[1]?.type === "finish" ? events[1].exitCode : -1, 7);
});

test("local budget blocks before the upstream process starts", async () => {
  const ctx = await launchContext();
  const config = { ...defaultConfig(), timezone: "UTC", budget: { runsPerDay: 1, sessionsPerDay: 1, warnAtPercent: 80 } };
  let starts = 0;
  const runner = async () => { starts += 1; return { exitCode: 0, signal: null }; };
  await launchCommand(ctx, config, "run", ["first"], runner);
  await assert.rejects(launchCommand(ctx, config, "run", ["second"], runner), /budget reached/);
  assert.equal(starts, 1);
});

test("help passthrough does not consume a launch budget", async () => {
  const ctx = await launchContext();
  const config = { ...defaultConfig(), timezone: "UTC", budget: { runsPerDay: 0, sessionsPerDay: 0, warnAtPercent: 80 } };
  const exit = await launchCommand(ctx, config, "run", ["--help"], async () => ({ exitCode: 0, signal: null }));
  assert.equal(exit, 0);
  assert.deepEqual(await readJournal(ctx.paths), []);
});

test("empty string arguments are preserved for OpenCode", async () => {
  const ctx = await launchContext();
  const config = { ...defaultConfig(), timezone: "UTC" };
  let seen: readonly string[] = [];
  await launchCommand(ctx, config, "run", [""], async (_file, args) => {
    seen = args;
    return { exitCode: 0, signal: null };
  });
  assert.deepEqual(seen, ["run", ""]);
});

test("explicit model flags are not duplicated", async () => {
  const ctx = await launchContext();
  const config = { ...defaultConfig(), timezone: "UTC", defaultModel: "opencode/default" };
  let seen: readonly string[] = [];
  await launchCommand(ctx, config, "run", ["--model", "custom/model", "prompt"], async (_file, args) => {
    seen = args;
    return { exitCode: 0, signal: null };
  });
  assert.deepEqual(seen, ["run", "--model", "custom/model", "prompt"]);
});
