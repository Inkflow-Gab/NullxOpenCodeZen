#!/usr/bin/env node
// Run the test suite, mirror TAP output to stdout, and emit GitHub Actions
// annotations for failures so they are visible without downloading raw logs.
//
//   node scripts/ci-test-report.mjs
//
// Outside CI it simply forwards the test runner's output and exit code.

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isCi = Boolean(process.env.GITHUB_ACTIONS);
const repo = fileURLToPath(new URL("..", import.meta.url));

// Discover test files rather than hardcoding a list, so new suites are never skipped.
function testFiles() {
  return readdirSync(path.join(repo, "test"))
    .filter((name) => name.endsWith(".test.ts"))
    .sort()
    .map((name) => path.join("test", name));
}

const files = testFiles();
if (files.length === 0) {
  process.stderr.write("No test files found\n");
  process.exit(1);
}

const child = spawn(process.execPath, ["--import", "tsx", "--test", "--test-reporter=tap", ...files], {
  cwd: repo,
  stdio: ["ignore", "pipe", "pipe"],
  shell: false,
});

let buffer = "";
const failures = [];
let current = null;

function escapeData(value) {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function consume(line) {
  // Node nests subtest TAP under indentation; match at any depth so a failing
  // assertion is reported, not just the top-level "test failed" wrapper.
  const notOk = /^\s*not ok \d+ - (.*)$/.exec(line);
  if (notOk) {
    current = { name: notOk[1].trim(), detail: [] };
    failures.push(current);
    return;
  }
  if (/^\s*(ok |# Subtest:|1\.\.\d+)/.test(line)) {
    current = null;
    return;
  }
  if (current) {
    const location = /location: '([^']+)'/.exec(line);
    if (location) current.location = location[1];
    const trimmed = line.trim();
    if (trimmed && !/^(---|\.\.\.|duration_ms:|type:|failureType:|code:|operator:|name:|expected:|actual:|stack:)/.test(trimmed)) {
      if (current.detail.length < 12) current.detail.push(trimmed);
    }
  }
}

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  buffer += text;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) consume(line.replace(/\r$/, ""));
});
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

child.on("close", (code) => {
  if (buffer) consume(buffer.replace(/\r$/, ""));
  if (isCi) {
    const useful = failures.filter((f) => !/^test failed$/.test(f.name));
    for (const failure of (useful.length > 0 ? useful : failures).slice(0, 10)) {
      const location = failure.location ? failure.location.replace(/^.*[/\\](test[/\\][^:]+):(\d+):(\d+)$/, "$1:$2") : "test";
      const [file, line] = String(location).split(/:(?=\d+$)/);
      const message = `${failure.name} — ${failure.detail.join(" ").slice(0, 700) || "see TAP output"}`;
      process.stdout.write(`::error file=${file ?? "test"},line=${line ?? 1}::${escapeData(message)}\n`);
    }
    if (failures.length === 0 && code !== 0) {
      process.stdout.write(`::error::Test runner exited with code ${code} without reporting a failing test\n`);
    }
  }
  process.exit(code ?? 1);
});
