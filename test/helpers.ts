import { mkdtemp, mkdir, writeFile, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { createPaths } from "../src/core/paths.js";
import { execute } from "../src/core/process.js";
import type { AppContext, ExecResult } from "../src/core/types.js";

export class MemoryStream extends Writable {
  text = "";
  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.text += chunk.toString();
    callback();
  }
}

export async function temporaryHome(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "nullx-test-"));
}

export async function context(home?: string, now = () => new Date("2026-11-03T04:00:00.000Z")): Promise<AppContext & { out: MemoryStream; err: MemoryStream; root: string }> {
  const root = home ?? await temporaryHome();
  const env: NodeJS.ProcessEnv = {
    NULLX_HOME: root,
    NO_COLOR: "1",
    NULLX_NO_AUTO_INSTALL: "1",
    PATH: "",
    // main() merges process.env, so pin LOCALAPPDATA inside the temp root.
    // Otherwise Windows tests would resolve the real user profile and write there.
    LOCALAPPDATA: path.join(root, "AppData", "Local"),
  };
  const out = new MemoryStream();
  const err = new MemoryStream();
  return {
    root,
    cwd: root,
    env,
    platform: process.platform,
    homeDir: root,
    stdout: out,
    stderr: err,
    now,
    paths: createPaths({ homeDir: root, env, platform: process.platform, cwd: root }),
    exec: execute,
    out,
    err,
  };
}

export async function fakeBinary(root: string, version = "1.19.5"): Promise<string> {
  const file = path.join(root, process.platform === "win32" ? "opencode.exe" : "opencode");
  if (process.platform === "win32") {
    // The CLI integration tests use a Node fixture through NULLX_OPENCODE_BINARY;
    // this helper is for POSIX executable detection tests.
    await writeFile(file, "fixture");
    return file;
  }
  await writeFile(file, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo '${version}'; exit 0; fi\nexit 0\n`);
  await chmod(file, 0o755);
  return file;
}

export const okResult: ExecResult = { exitCode: 0, signal: null, stdout: "", stderr: "", timedOut: false };

export async function writeConfig(ctx: AppContext, value: unknown): Promise<void> {
  await mkdir(ctx.paths.configDir, { recursive: true });
  await writeFile(ctx.paths.configFile, JSON.stringify(value), "utf8");
}
