import assert from "node:assert/strict";
import test from "node:test";
import { createPaths, managedBinaryPath } from "../src/core/paths.js";

test("NULLX_HOME isolates config, state, and managed installs", () => {
  const paths = createPaths({ homeDir: "/home/dev", cwd: "/work", env: { NULLX_HOME: "/tmp/nullx" }, platform: "linux" });
  assert.equal(paths.configFile, "/tmp/nullx/config.json");
  assert.equal(paths.journalFile, "/tmp/nullx/state/usage.jsonl");
  assert.match(managedBinaryPath(paths, "v2", "2.2.5", "linux"), /@opencode\/cli\/bin\/opencode\.exe$/);
});

test("Windows paths use roaming config and local state", () => {
  const paths = createPaths({
    homeDir: "C:\\Users\\dev",
    cwd: "C:\\work",
    env: { APPDATA: "C:\\Users\\dev\\AppData\\Roaming", LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local" },
    platform: "win32",
  });
  assert.equal(paths.configFile, "C:\\Users\\dev\\AppData\\Roaming\\nullx-opencode-zen\\config.json");
  assert.equal(paths.stateDir, "C:\\Users\\dev\\AppData\\Local\\nullx-opencode-zen\\state");
});
