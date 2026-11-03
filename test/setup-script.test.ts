import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const repo = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(repo, "scripts", "setup.sh");

test("setup.sh passes bash syntax checking", async () => {
  if (process.platform === "win32") return;
  await run("bash", ["-n", script]);
});

test("setup.sh never uses sudo and documents its options", async () => {
  const text = await readFile(script, "utf8");
  // Only executable lines matter; comments may legitimately mention sudo.
  const code = text.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("#")).join("\n");
  assert.doesNotMatch(code, /\bsudo\b/);
  for (const flag of ["--name", "--force", "--channel", "--skip-opencode", "--no-animation", "--no-color"]) {
    assert.ok(text.includes(flag), `setup.sh should document ${flag}`);
  }
});

test("setup.sh keeps a foreign nullx and installs nullx-zen beside it", async () => {
  if (process.platform === "win32") return;
  const home = await mkdtemp(path.join(os.tmpdir(), "nullx-sh-test-"));
  const bin = path.join(home, ".local", "bin");
  await mkdir(bin, { recursive: true });
  const foreign = path.join(bin, "nullx");
  const foreignBody = "#!/bin/sh\necho 'Nullx11 Code (free-claude-code 0.1.dev18)'\n";
  await writeFile(foreign, foreignBody);
  await chmod(foreign, 0o755);

  const { stdout, stderr } = await run("bash", [script, "--skip-opencode", "--no-animation", "--no-color"], {
    cwd: repo,
    env: { ...process.env, HOME: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, NULLX_HOME: path.join(home, "state") },
    timeout: 240_000,
  });
  const output = stdout + stderr;
  assert.match(output, /Setup finished/);
  assert.equal(await readFile(foreign, "utf8"), foreignBody, "the other program must not be modified");
  const launcher = path.join(bin, "nullx-zen");
  assert.match(await readFile(launcher, "utf8"), /nullx-opencode-zen-launcher/);
  const version = await run(launcher, ["--version"], { env: { ...process.env, HOME: home } });
  assert.match(version.stdout, /\d+\.\d+\.\d+/);
  assert.ok(!output.includes("[0/0]"), "no phantom progress line");
});
