import assert from "node:assert/strict";
import test from "node:test";
import { describeEnvironment, environmentLabel } from "../src/core/environment.js";

const ubuntuRelease = 'ID=ubuntu\nPRETTY_NAME="Ubuntu 24.04.3 LTS"\n';

test("detects Ubuntu under an Android/proot-like kernel", async () => {
  const info = await describeEnvironment({
    platform: "linux",
    architecture: "arm64",
    env: { TERMUX_VERSION: "0.118.3" },
    readText: async (file) => {
      if (file === "/etc/os-release") return ubuntuRelease;
      if (file === "/proc/version") return "Linux version 4.19.157-android12-9";
      if (file === "/proc/self/status") return "TracerPid:\t1234\n";
      return "";
    },
  });
  assert.equal(info.ubuntu, true);
  assert.equal(info.termux, true);
  assert.equal(info.prootLike, true);
  assert.match(environmentLabel(info), /proot-like/);
  assert.ok(info.hints.some((hint) => hint.includes("MOBILE-PROOT")));
});

test("does not label WSL as proot", async () => {
  const info = await describeEnvironment({
    platform: "linux",
    env: {},
    readText: async (file) => {
      if (file === "/etc/os-release") return ubuntuRelease;
      if (file === "/proc/version") return "Linux version 5.15.167.4-microsoft-standard-WSL2";
      return "";
    },
  });
  assert.equal(info.wsl, true);
  assert.equal(info.prootLike, false);
});

test("non-Linux environments stay quiet and platform-specific", async () => {
  const info = await describeEnvironment({ platform: "win32", architecture: "x64", env: {} });
  assert.equal(info.ubuntu, false);
  assert.equal(info.prootLike, false);
  assert.deepEqual(info.hints, []);
});
