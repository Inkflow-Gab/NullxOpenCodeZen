import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defaultConfig } from "../src/core/config.js";
import { detectOpenCode, parseVersion, pathCandidates } from "../src/core/detect.js";
import { context, fakeBinary, okResult } from "./helpers.js";

test("detects an executable on PATH and probes its version", async () => {
  const ctx = await context();
  const directory = path.join(ctx.root, "bin");
  await mkdir(directory);
  const file = await fakeBinary(directory);
  ctx.env.PATH = directory;
  ctx.exec = async () => ({ ...okResult, stdout: "1.19.5\n" });
  const detected = await detectOpenCode(ctx, defaultConfig());
  assert.equal(detected?.file, file);
  assert.equal(detected?.channel, "v1");
  assert.equal(detected?.source, "path");
});

test("explicit binary overrides fail closed when missing", async () => {
  const ctx = await context();
  ctx.env.NULLX_OPENCODE_BINARY = path.join(ctx.root, "missing-opencode");
  await assert.rejects(detectOpenCode(ctx, defaultConfig()), /not executable/);
});

test("Windows npm cmd shims resolve to the known native package binary", async () => {
  if (process.platform !== "win32") return;
  const ctx = await context();
  const directory = path.join(ctx.root, "npm");
  const native = path.join(directory, "node_modules", "opencode-ai", "bin", "opencode.exe");
  await mkdir(path.dirname(native), { recursive: true });
  await writeFile(path.join(directory, "opencode.cmd"), "@echo off\r\n");
  await writeFile(native, "fixture");
  ctx.env.PATH = directory;
  const candidates = await pathCandidates(ctx.env, ctx.platform);
  assert.ok(candidates.some((candidate) => candidate.file === native));
});

test("version parsing ignores terminal decoration", () => {
  assert.equal(parseVersion("opencode v2.2.5 (build 7)"), "2.2.5");
  assert.equal(parseVersion("no version"), undefined);
});
