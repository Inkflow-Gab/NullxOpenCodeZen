import assert from "node:assert/strict";
import test from "node:test";
import { main } from "../src/app.js";
import { context } from "./helpers.js";

test("CLI help, version, and unknown-command exit codes", async () => {
  const ctx = await context();
  assert.equal(await main(["--version"], ctx), 0);
  assert.match(ctx.out.text, /0\.1\.0/);
  assert.equal(await main(["help"], ctx), 0);
  assert.match(ctx.out.text, /nullx <command>/);
  assert.equal(await main(["not-a-command"], ctx), 2);
  assert.match(ctx.err.text, /Unknown command/);
  assert.equal(await main(["--not-global"], ctx), 2);
  assert.match(ctx.err.text, /Unknown global option/);
  assert.equal(await main(["--home"], ctx), 2);
  assert.match(ctx.err.text, /--home requires a path/);
});

test("CLI config, budget, status, paths, and history work without OpenCode installed", async () => {
  const ctx = await context();
  assert.equal(await main(["config", "init"], ctx), 0);
  assert.equal(await main(["budget", "set", "--runs", "2", "--timezone", "UTC"], ctx), 0);
  ctx.out.text = "";
  assert.equal(await main(["--json", "status"], ctx), 0);
  const status = JSON.parse(ctx.out.text) as { binary: unknown; budget: { runLimit: number } };
  assert.equal(status.binary, null);
  assert.equal(status.budget.runLimit, 2);
  ctx.out.text = "";
  assert.equal(await main(["--json", "paths"], ctx), 0);
  assert.match(ctx.out.text, /usage\.jsonl/);
  assert.equal(await main(["history"], ctx), 0);
  assert.match(ctx.out.text, /No local launches/);
});

test("budget reset requires explicit confirmation", async () => {
  const ctx = await context();
  assert.equal(await main(["budget", "reset"], ctx), 2);
  assert.match(ctx.err.text, /--yes/);
  assert.equal(await main(["budget", "reset", "--yes"], ctx), 0);
});

test("about includes the mascot and upstream attribution", async () => {
  const ctx = await context();
  assert.equal(await main(["about"], ctx), 0);
  assert.match(ctx.out.text, /NULLX|N U L L X/);
  assert.match(ctx.out.text, /anomalyco\/opencode/);
});

test("mascot command supports large, compact, and plain output", async () => {
  const ctx = await context();
  assert.equal(await main(["mascot", "--large"], ctx), 0);
  assert.match(ctx.out.text, /OPENCODE/);
  ctx.out.text = "";
  assert.equal(await main(["--no-color", "mascot", "--compact"], ctx), 0);
  assert.doesNotMatch(ctx.out.text, /\x1b/);
  assert.equal(await main(["mascot", "--large", "--compact"], ctx), 2);
});

test("doctor reports environment metadata and install validates retries", async () => {
  const ctx = await context();
  assert.equal(await main(["--json", "doctor"], ctx), 4);
  const report = JSON.parse(ctx.out.text) as { environment: { platform: string }; checks: { name: string }[] };
  assert.equal(report.environment.platform, process.platform);
  assert.ok(report.checks.some((check) => check.name === "environment"));
  ctx.out.text = "";
  ctx.err.text = "";
  assert.equal(await main(["install", "--retries", "9"], ctx), 3);
  assert.match(ctx.err.text, /--retries/);
});
