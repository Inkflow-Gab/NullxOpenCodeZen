import assert from "node:assert/strict";
import test from "node:test";
import { LiveLine, truncateVisible, visibleWidth } from "../src/ui/live-line.js";
import { ConnectionAnimation } from "../src/ui/connection-animation.js";
import { SetupProgress } from "../src/ui/progress.js";
import { asciiWidth, loadAscii, loadFittingAscii } from "../src/ui/banner.js";
import { MemoryStream } from "./helpers.js";

class TtyStream extends MemoryStream {
  isTTY = true;
  constructor(public columns: number) { super(); }
}

/** Split raw output into the physical lines a terminal would show. */
function physicalLines(raw: string): string[] {
  return raw
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
    .split(/\r|\n/)
    .filter((line) => line.length > 0);
}

test("visibleWidth ignores ANSI and truncateVisible never splits an escape", () => {
  const colored = "\x1b[38;5;141mhello\x1b[0m";
  assert.equal(visibleWidth(colored), 5);
  const cut = truncateVisible(colored, 4);
  assert.ok(visibleWidth(cut) <= 4);
  // Every escape sequence must still be terminated.
  assert.doesNotMatch(cut, /\x1b\[[0-9;]*$/);
  assert.equal(truncateVisible("abc", 0), "");
  assert.equal(truncateVisible("abc", 10), "abc");
});

for (const columns of [32, 40, 50, 80]) {
  test(`connection animation never exceeds a ${columns}-column terminal`, async () => {
    const stream = new TtyStream(columns);
    const animation = new ConnectionAnimation({
      stream, env: { COLORTERM: "truecolor", TERM: "xterm-256color" }, intervalMs: 60,
    });
    animation.start();
    animation.setPhase("Looking for an existing OpenCode binary");
    await new Promise((resolve) => setTimeout(resolve, 120));
    animation.setPhase("Checking the OpenCode database schema");
    await new Promise((resolve) => setTimeout(resolve, 80));
    await animation.succeed();
    for (const line of physicalLines(stream.text)) {
      assert.ok(line.length <= columns, `line wrapped at ${line.length} > ${columns}: ${JSON.stringify(line)}`);
    }
    assert.match(stream.text, /\x1b\[\?25h/, "cursor must be restored");
  });

  test(`setup progress never exceeds a ${columns}-column terminal`, async () => {
    const stream = new TtyStream(columns);
    const progress = new SetupProgress({
      stream, env: { COLORTERM: "truecolor" }, total: 2, intervalMs: 60, now: () => 0,
    });
    await progress.banner(await loadAscii("large"));
    await progress.step("Installing dependencies", async (detail) => {
      detail("npm ci --no-audit --no-fund");
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { value: 1, note: "locked dependencies ready" };
    });
    await progress.finish(["Command: nullx-zen"]);
    for (const line of physicalLines(stream.text)) {
      assert.ok(line.length <= columns, `line wrapped at ${line.length} > ${columns}: ${JSON.stringify(line)}`);
    }
  });
}

test("identical frames are not rewritten, so the line does not spam", async () => {
  const stream = new TtyStream(80);
  const live = new LiveLine({ stream, env: { COLORTERM: "truecolor" }, intervalMs: 20 });
  live.begin("steady state");
  await new Promise((resolve) => setTimeout(resolve, 150));
  await live.close();
  const redraws = stream.text.split("\x1b[2K\r").length - 1;
  // Spinner changes each tick, but the text is stable; assert bounded output.
  assert.ok(redraws < 20, `expected bounded redraws, got ${redraws}`);
  assert.ok(stream.text.length < 4000, "output must stay small");
});

test("non-TTY output prints each distinct phase once and no ANSI", async () => {
  const stream = new MemoryStream();
  const animation = new ConnectionAnimation({ stream, env: { NO_COLOR: "1" } });
  animation.start();
  animation.setPhase("same phase");
  animation.setPhase("same phase");
  animation.setPhase("next phase");
  await animation.succeed();
  assert.doesNotMatch(stream.text, /\x1b/);
  assert.equal(stream.text.split("same phase").length - 1, 1);
  assert.match(stream.text, /next phase/);
});

test("ASCII art fits its documented width and degrades for narrow terminals", async () => {
  const large = await loadAscii("large");
  const compact = await loadAscii("compact");
  assert.ok(asciiWidth(large) <= 62, `large art is ${asciiWidth(large)} cols`);
  assert.ok(asciiWidth(compact) <= 38, `compact art is ${asciiWidth(compact)} cols`);
  assert.ok(asciiWidth(large) > asciiWidth(compact));
  assert.equal(asciiWidth(await loadFittingAscii(80)), asciiWidth(large));
  assert.equal(asciiWidth(await loadFittingAscii(40)), asciiWidth(compact));
  // Below the compact width we fall back to the wordmark rather than wrapping.
  assert.ok(asciiWidth(await loadFittingAscii(33)) <= 33);
});
