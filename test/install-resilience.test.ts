import assert from "node:assert/strict";
import { mkdir, readdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defaultConfig } from "../src/core/config.js";
import { installOpenCode, REGISTRY } from "../src/core/install.js";
import { installDirectory, RELEASES } from "../src/core/paths.js";
import { context, okResult } from "./helpers.js";

function metadata(): unknown {
  return {
    name: RELEASES.v1.packageName,
    version: RELEASES.v1.version,
    dist: { integrity: RELEASES.v1.integrity, tarball: `${REGISTRY}opencode-ai/-/opencode-ai-1.19.5.tgz` },
  };
}

test("transient npm failures are retried and progress is reported", async () => {
  const ctx = await context();
  const phases: string[] = [];
  let npmCalls = 0;
  ctx.exec = async (_file, args) => {
    if (args[0] === "/fake/npm-cli.js") {
      npmCalls += 1;
      if (npmCalls === 1) return { ...okResult, exitCode: 1, stderr: "EAI_AGAIN" };
      const prefix = args[args.indexOf("--prefix") + 1]!;
      const binary = path.join(prefix, "node_modules", "opencode-ai", "bin", "opencode.exe");
      await mkdir(path.dirname(binary), { recursive: true });
      await writeFile(binary, "fixture");
      return okResult;
    }
    return { ...okResult, stdout: "1.19.5\n" };
  };
  const result = await installOpenCode(ctx, defaultConfig(), {
    force: true,
    retries: 1,
    progress: (phase) => phases.push(phase),
  }, {
    fetchMetadata: async () => metadata(),
    npmCli: "/fake/npm-cli.js",
    sleep: async () => undefined,
  });
  assert.equal(result.status, "installed");
  assert.equal(npmCalls, 2);
  assert.ok(phases.some((phase) => phase.includes("retrying")));
  assert.ok(phases.some((phase) => phase.includes("Verifying")));
});

test("repair removes stale staging artifacts before reinstalling", async () => {
  const ctx = await context();
  const target = installDirectory(ctx.paths, "v1", "1.19.5", ctx.platform);
  const stale = `${target}.staging-old`;
  await mkdir(stale, { recursive: true });
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(stale, old, old);
  ctx.exec = async (_file, args) => {
    if (args[0] === "/fake/npm-cli.js") {
      const prefix = args[args.indexOf("--prefix") + 1]!;
      const binary = path.join(prefix, "node_modules", "opencode-ai", "bin", "opencode.exe");
      await mkdir(path.dirname(binary), { recursive: true });
      await writeFile(binary, "fixture");
      return okResult;
    }
    return { ...okResult, stdout: "1.19.5\n" };
  };
  const result = await installOpenCode(ctx, defaultConfig(), { repair: true }, {
    fetchMetadata: async () => metadata(),
    npmCli: "/fake/npm-cli.js",
  });
  assert.equal(result.status, "installed");
  const entries = await readdir(path.dirname(target));
  assert.equal(entries.some((entry) => entry === "1.19.5.staging-old"), false);
});
