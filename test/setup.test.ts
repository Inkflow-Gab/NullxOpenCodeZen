import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { main } from "../src/app.js";
import { defaultBinDir, LAUNCHER_MARKER } from "../src/core/launcher.js";
import { SetupProgress, progressBar } from "../src/ui/progress.js";
import { context, MemoryStream, okResult } from "./helpers.js";

class TtyStream extends MemoryStream {
  isTTY = true;
  columns = 80;
}

test("progress bar clamps and renders both colored and plain forms", () => {
  assert.equal(progressBar(0, 4, 4, false), "[----]");
  assert.equal(progressBar(4, 4, 4, false), "[####]");
  assert.equal(progressBar(9, 4, 4, false), "[####]");
  assert.equal(progressBar(2, 4, 4, true), "██░░");
});

test("setup progress prints ordered plain steps without ANSI when not a TTY", async () => {
  const stream = new MemoryStream();
  const progress = new SetupProgress({ stream, env: { NO_COLOR: "1" }, total: 2, now: () => 0 });
  await progress.step("First", async () => ({ value: 1, note: "one" }));
  await progress.step("Second", async (detail) => {
    detail("working");
    return 2;
  });
  await progress.finish(["done"]);
  assert.match(stream.text, /\[1\/2\] First/);
  assert.match(stream.text, /ok First .*— one/);
  assert.match(stream.text, /working/);
  assert.match(stream.text, /Setup complete/);
  assert.doesNotMatch(stream.text, /\x1b/);
});

test("setup progress restores the cursor when a step fails", async () => {
  const stream = new TtyStream();
  const progress = new SetupProgress({ stream, env: { COLORTERM: "truecolor" }, total: 1, intervalMs: 1000 });
  await assert.rejects(progress.step("Explode", async () => { throw new Error("boom"); }), /boom/);
  await progress.abort("stopped");
  const plain = stream.text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  assert.match(plain, /Explode: boom/);
  assert.match(stream.text, /\x1b\[\?25h/);
});

test("nullx setup --json reports the fallback command when nullx is taken", async () => {
  const ctx = await context();
  const bin = defaultBinDir(ctx);
  await mkdir(bin, { recursive: true });
  const foreign = path.join(bin, process.platform === "win32" ? "nullx.cmd" : "nullx");
  await writeFile(foreign, process.platform === "win32" ? "@echo off\r\necho fcc\r\n" : "#!/bin/sh\necho fcc\n");
  if (process.platform !== "win32") await chmod(foreign, 0o755);

  assert.equal(await main(["--json", "setup", "--skip-opencode", "--no-path"], ctx), 0);
  const result = JSON.parse(ctx.out.text) as {
    ok: boolean; command: string; launcher: { file: string }; warnings: string[]; nextSteps: string[];
  };
  assert.equal(result.ok, true);
  assert.equal(result.command, "nullx-zen");
  assert.match(await readFile(foreign, "utf8"), /fcc/);
  assert.match(await readFile(result.launcher.file, "utf8"), new RegExp(LAUNCHER_MARKER));
  assert.ok(result.warnings.some((warning) => warning.includes("already owns")));
  assert.ok(result.nextSteps.every((step) => step.startsWith("nullx-zen ")));
  assert.equal(ctx.err.text, "", "JSON mode must not emit progress noise");
});

test("nullx setup refuses an explicit foreign name and exits with the config code", async () => {
  const ctx = await context();
  const bin = defaultBinDir(ctx);
  await mkdir(bin, { recursive: true });
  const foreign = path.join(bin, process.platform === "win32" ? "nullx.cmd" : "nullx");
  await writeFile(foreign, process.platform === "win32" ? "@echo off\r\necho fcc\r\n" : "#!/bin/sh\necho fcc\n");
  assert.equal(await main(["--json", "setup", "--name", "nullx", "--skip-opencode", "--no-path"], ctx), 3);
  const result = JSON.parse(ctx.out.text) as { ok: boolean; error: { code: string } };
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "LAUNCHER_CONFLICT");
});

test("nullx setup validates channel, retries, and name shape", async () => {
  const ctx = await context();
  assert.equal(await main(["setup", "--channel", "v9"], ctx), 3);
  ctx.err.text = "";
  assert.equal(await main(["setup", "--retries", "99"], ctx), 3);
  ctx.err.text = "";
  assert.equal(await main(["--json", "setup", "--name", "bad name", "--skip-opencode"], ctx), 2);
});

test("nullx setup installs OpenCode through the injected executor", async () => {
  const ctx = await context();
  ctx.env.NULLX_NO_AUTO_INSTALL = "";
  ctx.exec = async (file, args) => {
    if (args.includes("--version")) return { ...okResult, stdout: "1.19.5\n" };
    return okResult;
  };
  // Use skip-opencode=false but a pre-seeded PATH binary so no network is touched.
  const bin = path.join(ctx.root, "opencode-bin");
  await mkdir(bin, { recursive: true });
  if (process.platform === "win32") {
    await writeFile(path.join(bin, "opencode.exe"), "fixture");
  } else {
    const file = path.join(bin, "opencode");
    await writeFile(file, "#!/bin/sh\necho 1.19.5\n");
    await chmod(file, 0o755);
  }
  ctx.env.PATH = bin;
  assert.equal(await main(["--json", "setup", "--no-path"], ctx), 0);
  const result = JSON.parse(ctx.out.text) as { ok: boolean; binary: { version: string } | null };
  assert.equal(result.ok, true);
  assert.equal(result.binary?.version, "1.19.5");
});
