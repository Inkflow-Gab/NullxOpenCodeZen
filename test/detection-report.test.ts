import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defaultConfig } from "../src/core/config.js";
import { inspectOpenCode } from "../src/core/detect.js";
import { context, fakeBinary, okResult } from "./helpers.js";

test("inspection reports broken explicit overrides instead of silently falling back", async () => {
  const ctx = await context();
  ctx.env.NULLX_OPENCODE_BINARY = path.join(ctx.root, "missing");
  const report = await inspectOpenCode(ctx, defaultConfig());
  assert.equal(report.selected, null);
  assert.equal(report.candidates[0]?.status, "error");
  assert.ok(report.warnings.some((warning) => warning.includes("explicit environment binary")));
});

test("inspection enumerates PATH candidates and selects the first working binary", async () => {
  const ctx = await context();
  const first = path.join(ctx.root, "first");
  const second = path.join(ctx.root, "second");
  await mkdir(first);
  await mkdir(second);
  const firstBinary = await fakeBinary(first, "1.19.5");
  const secondBinary = await fakeBinary(second, "2.2.5");
  ctx.env.PATH = `${first}${path.delimiter}${second}`;
  ctx.exec = async (file) => ({ ...okResult, stdout: file === firstBinary ? "1.19.5\n" : "2.2.5\n" });
  const report = await inspectOpenCode(ctx, defaultConfig());
  assert.equal(report.selected?.file, firstBinary);
  assert.equal(report.candidates.length, 2);
  assert.equal(report.candidates[1]?.file, secondBinary);
  assert.ok(report.warnings.some((warning) => warning.includes("v1 and v2")));
});
