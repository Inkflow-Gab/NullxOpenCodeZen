import assert from "node:assert/strict";
import test from "node:test";
import { execute, runInherited } from "../src/core/process.js";

test("capture executor returns stdout and exit status without a shell", async () => {
  const result = await execute(process.execPath, ["-e", "process.stdout.write('ok'); process.exit(3)"]);
  assert.equal(result.stdout, "ok");
  assert.equal(result.exitCode, 3);
});

test("shell metacharacters remain literal arguments", async () => {
  const literal = "hello; echo injected";
  const result = await execute(process.execPath, ["-e", "process.stdout.write(process.argv[1])", literal]);
  assert.equal(result.stdout, literal);
});

test("capture executor enforces timeouts and output ceilings", async () => {
  const timed = await execute(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], { timeoutMs: 50 });
  assert.equal(timed.timedOut, true);
  const oversized = await execute(process.execPath, ["-e", "process.stdout.write('x'.repeat(100))"], { maxOutputBytes: 8 });
  assert.equal(oversized.error?.code, "OUTPUT_LIMIT");
  assert.ok(oversized.stdout.length <= 8);
});

test("inherited runner propagates nonzero exit codes", async () => {
  const result = await runInherited(process.execPath, ["-e", "process.exit(9)"], { cwd: process.cwd(), env: process.env });
  assert.equal(result.exitCode, 9);
  assert.equal(result.signal, null);
});
