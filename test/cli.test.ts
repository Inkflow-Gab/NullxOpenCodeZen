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
  assert.match(ctx.out.text, /NULLX/);
  assert.match(ctx.out.text, /anomalyco\/opencode/);
});
