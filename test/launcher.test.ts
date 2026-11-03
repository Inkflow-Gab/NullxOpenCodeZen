import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  defaultBinDir,
  findCommandConflict,
  inspectLauncher,
  installLauncher,
  LAUNCHER_MARKER,
  PATH_MARKER,
  renderLauncher,
} from "../src/core/launcher.js";
import { context } from "./helpers.js";

const posix = process.platform !== "win32";

async function foreignCommand(dir: string, name = "nullx"): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, process.platform === "win32" ? `${name}.cmd` : name);
  await writeFile(file, process.platform === "win32" ? "@echo off\r\necho other-tool\r\n" : "#!/bin/sh\necho other-tool\n");
  if (posix) await chmod(file, 0o755);
  return file;
}

test("launcher script is marked, quoted, and falls back to PATH node", () => {
  const script = renderLauncher("/opt/my repo/dist/cli.js", "/usr/bin/node", "linux");
  assert.match(script, /^#!\/bin\/sh/);
  assert.ok(script.includes(LAUNCHER_MARKER));
  assert.ok(script.includes("'/opt/my repo/dist/cli.js'"));
  assert.match(script, /\[ -x "\$NODE" \] \|\| NODE=node/);
  const cmd = renderLauncher("C:\\app\\dist\\cli.js", "C:\\node.exe", "win32");
  assert.match(cmd, /@echo off/);
  assert.ok(cmd.includes("%*"));
});

test("setup installs nullx when the name is free", async () => {
  const ctx = await context();
  const result = await installLauncher(ctx, { entryPoint: "/app/dist/cli.js", updatePath: false });
  assert.equal(result.name, "nullx");
  assert.equal(result.action, "created");
  assert.equal(result.binDir, defaultBinDir(ctx));
  const text = await readFile(result.file, "utf8");
  assert.ok(text.includes(LAUNCHER_MARKER));
});

test("a foreign nullx is never clobbered: setup falls back to nullx-zen", async () => {
  const ctx = await context();
  const existing = await foreignCommand(defaultBinDir(ctx));
  const before = await readFile(existing, "utf8");
  const result = await installLauncher(ctx, { entryPoint: "/app/dist/cli.js", updatePath: false });
  assert.equal(result.name, "nullx-zen");
  assert.equal(result.renamedFrom, "nullx");
  assert.equal(await readFile(existing, "utf8"), before, "the other program must stay byte-identical");
});

test("an explicit foreign name is refused unless forced, and force keeps a backup", async () => {
  const ctx = await context();
  const existing = await foreignCommand(defaultBinDir(ctx));
  await assert.rejects(
    installLauncher(ctx, { name: "nullx", entryPoint: "/app/dist/cli.js", updatePath: false }),
    /belongs to another program/,
  );
  const result = await installLauncher(ctx, { name: "nullx", force: true, entryPoint: "/app/dist/cli.js", updatePath: false });
  assert.equal(result.action, "replaced-foreign");
  assert.ok(result.backup);
  assert.match(await readFile(result.backup!, "utf8"), /other-tool/);
  assert.match(await readFile(result.file, "utf8"), new RegExp(LAUNCHER_MARKER));
  const entries = await readdir(defaultBinDir(ctx));
  assert.ok(entries.some((entry) => entry.includes(".backup-")));
});

test("rerunning setup is idempotent and reuses its own launcher", async () => {
  const ctx = await context();
  const first = await installLauncher(ctx, { entryPoint: "/app/dist/cli.js", updatePath: false });
  const second = await installLauncher(ctx, { entryPoint: "/app/dist/cli.js", updatePath: false });
  assert.equal(first.file, second.file);
  assert.equal(second.action, "unchanged");
});

test("PATH snippets are appended once per shell config", async () => {
  if (!posix) return;
  const ctx = await context();
  ctx.env.PATH = "";
  const first = await installLauncher(ctx, { entryPoint: "/app/dist/cli.js" });
  assert.equal(first.pathAlreadyPresent, false);
  assert.ok(first.pathUpdated.length >= 1);
  const second = await installLauncher(ctx, { entryPoint: "/app/dist/cli.js" });
  assert.deepEqual(second.pathUpdated, []);
  const bashrc = await readFile(path.join(ctx.homeDir, ".bashrc"), "utf8");
  assert.equal(bashrc.split(PATH_MARKER).length - 1, 1);
});

test("inspection distinguishes missing, ours, and foreign commands", async () => {
  const ctx = await context();
  const dir = defaultBinDir(ctx);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "nullx");
  assert.equal((await inspectLauncher(file, "/app/dist/cli.js")).owner, "missing");
  await writeFile(file, renderLauncher("/app/dist/cli.js", "/usr/bin/node", "linux"));
  assert.equal((await inspectLauncher(file, "/app/dist/cli.js")).owner, "ours");
  await writeFile(file, "#!/bin/sh\necho free-claude-code\n");
  assert.equal((await inspectLauncher(file, "/app/dist/cli.js")).owner, "foreign");
});

test("command conflict detection explains PATH shadowing", async () => {
  const ctx = await context();
  const dir = path.join(ctx.root, "bin");
  const file = await foreignCommand(dir);
  ctx.env.PATH = dir;
  const conflict = await findCommandConflict(ctx, "nullx", "/app/dist/cli.js");
  assert.equal(conflict?.file, file);
  assert.equal(conflict?.owner, "foreign");
  assert.equal(await findCommandConflict(ctx, "absent-command", "/app/dist/cli.js"), null);
});

test("Windows PATH is persisted at user scope through an injected executor", async () => {
  const ctx = await context();
  ctx.platform = "win32";
  const calls: { file: string; args: readonly string[] }[] = [];
  ctx.exec = async (file, args) => {
    calls.push({ file, args });
    return { exitCode: 0, signal: null, stdout: "updated\n", stderr: "", timedOut: false };
  };
  const binDir = path.join(ctx.root, "win-bin");
  const result = await installLauncher(ctx, { binDir, entryPoint: "C:\\app\\dist\\cli.js", nodePath: "C:\\node.exe" });
  assert.equal(result.file.endsWith("nullx.cmd"), true);
  assert.deepEqual(result.pathUpdated, ["HKCU\\Environment:Path"]);
  assert.equal(calls[0]?.file, "powershell.exe");
  const script = calls[0]?.args.join(" ") ?? "";
  assert.match(script, /SetEnvironmentVariable\('Path', \$next, 'User'\)/);
  assert.doesNotMatch(script, /'Machine'/);
});

test("a failing Windows PATH update still leaves a usable launcher", async () => {
  const ctx = await context();
  ctx.platform = "win32";
  ctx.exec = async () => ({ exitCode: 1, signal: null, stdout: "", stderr: "denied", timedOut: false });
  const binDir = path.join(ctx.root, "win-bin");
  const result = await installLauncher(ctx, { binDir, entryPoint: "C:\\app\\dist\\cli.js", nodePath: "C:\\node.exe" });
  assert.equal(result.action, "created");
  assert.deepEqual(result.pathUpdated, []);
  assert.match(await readFile(result.file, "utf8"), /@echo off/);
});
