import assert from "node:assert/strict";
import test from "node:test";
import {
  animationEnabled,
  blend,
  colorMode,
  withConnectionAnimation,
  ConnectionAnimation,
} from "../src/ui/connection-animation.js";
import type { EnvironmentInfo } from "../src/core/environment.js";
import { MemoryStream } from "./helpers.js";

class TtyStream extends MemoryStream {
  isTTY = true;
  columns = 80;
}

const environment: EnvironmentInfo = {
  platform: "linux",
  architecture: "arm64",
  distribution: "Ubuntu 24.04",
  distributionId: "ubuntu",
  ubuntu: true,
  termux: true,
  prootLike: true,
  wsl: false,
  androidKernel: true,
  nodeVersion: "22.22.3",
  hints: [],
};

test("color modes respect NO_COLOR, dumb terminals, and truecolor", () => {
  assert.equal(colorMode({}, true), "none");
  assert.equal(colorMode({ COLORTERM: "truecolor" }, true), "truecolor");
  assert.equal(colorMode({ TERM: "xterm-256color" }, true), "256");
  assert.equal(colorMode({ COLORTERM: "truecolor", NO_COLOR: "1" }, true), "none");
  assert.equal(colorMode({ COLORTERM: "truecolor" }, false), "none");
  assert.equal(blend("nullx", "none"), "nullx");
  assert.match(blend("nullx", "truecolor"), /\x1b\[38;2;/);
});

test("animation is disabled for CI, plain mode, and explicit opt-out", () => {
  assert.equal(animationEnabled({}, true), true);
  assert.equal(animationEnabled({ CI: "true" }, true), false);
  assert.equal(animationEnabled({ NULLX_NO_ANIMATION: "1" }, true), false);
  assert.equal(animationEnabled({}, true, true), false);
  assert.equal(animationEnabled({}, false), false);
});

test("non-TTY output is plain and never claims a verified Zen connection", async () => {
  const stream = new MemoryStream();
  const result = await withConnectionAnimation(async (phase) => {
    phase("Checking the local OpenCode runtime");
    return 42;
  }, { stream, env: { NO_COLOR: "1" }, environment });
  assert.equal(result, 42);
  assert.match(stream.text, /Connecting to OpenCode Zen/);
  assert.match(stream.text, /Keep OpenCode open in your other session/);
  assert.match(stream.text, /\[ok\] OpenCode ready/);
  assert.doesNotMatch(stream.text, /\x1b/);
  assert.doesNotMatch(stream.text, /connected to OpenCode Zen/i);
});

test("TTY animation restores the cursor after success and failure", async () => {
  const success = new TtyStream();
  const ok = new ConnectionAnimation({ stream: success, env: { COLORTERM: "truecolor" }, environment, intervalMs: 1000 });
  ok.start();
  ok.setPhase("Installing OpenCode");
  await ok.succeed();
  assert.match(success.text, /\x1b\[\?25l/);
  assert.match(success.text, /\x1b\[\?25h/);

  const failure = new TtyStream();
  const bad = new ConnectionAnimation({ stream: failure, env: { COLORTERM: "truecolor" }, environment, intervalMs: 1000 });
  bad.start();
  await bad.fail("OpenCode preparation failed");
  assert.match(failure.text, /\x1b\[\?25h/);
  const plain = failure.text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  assert.match(plain, /OpenCode preparation failed/);
});
