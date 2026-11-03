import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defaultConfig, loadConfig } from "../src/core/config.js";
import { buildPlan, installOpenCode, REGISTRY } from "../src/core/install.js";
import { RELEASES } from "../src/core/paths.js";
import { context, fakeBinary, okResult } from "./helpers.js";

function metadata(channel: "v1" | "v2", integrity = RELEASES[channel].integrity): unknown {
  const release = RELEASES[channel];
  return { name: release.packageName, version: release.version, dist: { integrity, tarball: `${REGISTRY}${release.packageName}/-/${release.packageName}-${release.version}.tgz` } };
}

test("install plan pins the official package and avoids shell execution", async () => {
  const ctx = await context();
  const plan = buildPlan(ctx, "v1", "1.19.5");
  assert.equal(plan.packageSpec, "opencode-ai@1.19.5");
  assert.ok(plan.npmArguments.includes("--registry=https://registry.npmjs.org/"));
  assert.ok(plan.npmArguments.includes("--no-package-lock"));
  assert.ok(plan.binaryPath.endsWith(path.join("opencode-ai", "bin", "opencode.exe")));
});

test("dry run performs no install execution", async () => {
  const ctx = await context();
  ctx.exec = async () => { throw new Error("must not execute"); };
  const result = await installOpenCode(ctx, defaultConfig(), { dryRun: true });
  assert.equal(result.status, "planned");
});

test("an existing matching install is reused", async () => {
  const ctx = await context();
  const file = await fakeBinary(ctx.root);
  ctx.env.NULLX_OPENCODE_BINARY = file;
  ctx.exec = async () => ({ ...okResult, stdout: "1.19.5\n" });
  const result = await installOpenCode(ctx, defaultConfig());
  assert.equal(result.status, "already-installed");
});

test("pinned integrity mismatch blocks installation", async () => {
  const ctx = await context();
  await assert.rejects(installOpenCode(ctx, defaultConfig(), { force: true }, {
    fetchMetadata: async () => metadata("v1", `sha512-${"A".repeat(88)}`),
    npmCli: "/fake/npm-cli.js",
  }), /reviewed SHA-512/);
});

test("managed install stages, verifies, records a receipt, and updates channel", async () => {
  const ctx = await context();
  const npmCli = "/fake/npm-cli.js";
  ctx.exec = async (_file, args) => {
    if (args[0] === npmCli) {
      const prefix = args[args.indexOf("--prefix") + 1]!;
      const binary = path.join(prefix, "node_modules", "opencode-ai", "bin", "opencode.exe");
      await mkdir(path.dirname(binary), { recursive: true });
      await writeFile(binary, "fixture");
      return okResult;
    }
    assert.deepEqual(args, ["--version"]);
    assert.match(_file, /\.staging-.*node_modules/);
    return { ...okResult, stdout: "1.19.5\n" };
  };
  const result = await installOpenCode(ctx, defaultConfig(), { force: true }, { fetchMetadata: async () => metadata("v1"), npmCli });
  assert.equal(result.status, "installed");
  if (result.status !== "installed") return;
  assert.equal(result.receipt.packageVersion, "1.19.5");
  assert.equal(result.receipt.integrity, RELEASES.v1.integrity);
  assert.equal((await loadConfig(ctx)).channel, "v1");
  await assert.doesNotReject(() => import("node:fs/promises").then((fs) => fs.access(result.receipt.binaryPath)));
});
