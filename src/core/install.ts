import { randomUUID } from "node:crypto";
import { access, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { detectOpenCode, probeVersion } from "./detect.js";
import { AppError, EXIT, errorMessage } from "./errors.js";
import { writeJsonAtomic } from "./json.js";
import { withLock } from "./lock.js";
import { ensurePrivateDirectory, installDirectory, managedBinaryPath, packageBinaryPath, RELEASES } from "./paths.js";
import { saveConfig } from "./config.js";
import type { AppContext, Channel, DetectedBinary, InstallReceipt, NullxConfig } from "./types.js";
import { isRecord, versionValue } from "./validation.js";

export const REGISTRY = "https://registry.npmjs.org/";

export interface InstallOptions {
  channel?: Channel;
  version?: string;
  force?: boolean;
  dryRun?: boolean;
}

export interface PackageMetadata {
  name: string;
  version: string;
  integrity: string;
  tarball: string;
}

export interface InstallPlan {
  channel: Channel;
  packageName: string;
  packageVersion: string;
  packageSpec: string;
  registry: string;
  targetDirectory: string;
  binaryPath: string;
  npmArguments: string[];
}

export type InstallResult =
  | { status: "already-installed"; binary: DetectedBinary }
  | { status: "planned"; plan: InstallPlan }
  | { status: "installed"; receipt: InstallReceipt; binary: DetectedBinary };

interface InstallDependencies {
  fetchMetadata?: (url: string) => Promise<unknown>;
  npmCli?: string;
}

async function fetchBoundedJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`registry returned HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("registry response has no body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        throw new Error("registry metadata exceeds 1 MiB");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

export async function findNpmCli(ctx: AppContext): Promise<string> {
  const module = ctx.platform === "win32" ? path.win32 : path.posix;
  const candidates: string[] = [];
  if (ctx.env.npm_execpath?.endsWith("npm-cli.js")) candidates.push(ctx.env.npm_execpath);
  const nodeDirectory = path.dirname(process.execPath);
  candidates.push(
    module.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    module.resolve(nodeDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    module.resolve(nodeDirectory, "..", "local", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  );
  for (const directory of (ctx.env.PATH ?? ctx.env.Path ?? "").split(module.delimiter).filter(Boolean).slice(0, 256)) {
    candidates.push(module.join(directory, "node_modules", "npm", "bin", "npm-cli.js"));
    try {
      const resolved = await realpath(module.join(directory, ctx.platform === "win32" ? "npm.cmd" : "npm"));
      if (resolved.endsWith("npm-cli.js")) candidates.push(resolved);
    } catch {
      // PATH entries frequently contain unrelated or missing executables.
    }
  }
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new AppError("NPM_NOT_FOUND", "Cannot find npm-cli.js. Install Node.js with npm, then retry.", EXIT.INSTALL);
}

export function buildPlan(ctx: AppContext, channel: Channel, version: string, staging?: string): InstallPlan {
  const release = RELEASES[channel];
  const targetDirectory = installDirectory(ctx.paths, channel, version, ctx.platform);
  const prefix = staging ?? targetDirectory;
  const packageSpec = `${release.packageName}@${version}`;
  return {
    channel,
    packageName: release.packageName,
    packageVersion: version,
    packageSpec,
    registry: REGISTRY,
    targetDirectory,
    binaryPath: managedBinaryPath(ctx.paths, channel, version, ctx.platform),
    npmArguments: [
      "install",
      "--prefix", prefix,
      "--no-save",
      "--no-package-lock",
      "--no-audit",
      "--no-fund",
      "--include=optional",
      "--loglevel=error",
      `--registry=${REGISTRY}`,
      packageSpec,
    ],
  };
}

function validateMetadata(raw: unknown, plan: InstallPlan): PackageMetadata {
  if (!isRecord(raw) || raw.name !== plan.packageName || raw.version !== plan.packageVersion || !isRecord(raw.dist)) {
    throw new AppError("REGISTRY_METADATA_INVALID", "Registry metadata does not match the requested official package", EXIT.INSTALL);
  }
  const integrity = raw.dist.integrity;
  const tarball = raw.dist.tarball;
  if (typeof integrity !== "string" || !/^sha512-[A-Za-z0-9+/=]+$/.test(integrity) || typeof tarball !== "string") {
    throw new AppError("REGISTRY_METADATA_INVALID", "Registry metadata is missing SHA-512 integrity", EXIT.INSTALL);
  }
  let url: URL;
  try { url = new URL(tarball); } catch {
    throw new AppError("REGISTRY_METADATA_INVALID", "Registry tarball URL is invalid", EXIT.INSTALL);
  }
  if (url.protocol !== "https:" || url.hostname !== "registry.npmjs.org") {
    throw new AppError("REGISTRY_METADATA_INVALID", "Registry tarball must come from registry.npmjs.org over HTTPS", EXIT.INSTALL);
  }
  const pinned = RELEASES[plan.channel];
  if (plan.packageVersion === pinned.version && integrity !== pinned.integrity) {
    throw new AppError("INTEGRITY_MISMATCH", `The pinned ${plan.packageSpec} tarball no longer matches the reviewed SHA-512 integrity`, EXIT.INSTALL);
  }
  return { name: plan.packageName, version: plan.packageVersion, integrity, tarball };
}

async function replaceDirectory(staging: string, target: string): Promise<void> {
  await ensurePrivateDirectory(path.dirname(target));
  let backup: string | undefined;
  try {
    await access(target);
    backup = `${target}.previous-${randomUUID()}`;
    await rename(target, backup);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await rename(staging, target);
  } catch (error) {
    if (backup) await rename(backup, target).catch(() => undefined);
    throw error;
  }
  if (backup) await rm(backup, { recursive: true, force: true });
}

export async function installOpenCode(
  ctx: AppContext,
  config: NullxConfig,
  options: InstallOptions = {},
  dependencies: InstallDependencies = {},
): Promise<InstallResult> {
  const channel = options.channel ?? config.channel;
  const version = versionValue(options.version ?? RELEASES[channel].version);
  const force = options.force ?? false;
  if (!force && !options.dryRun) {
    const existing = await detectOpenCode(ctx, config);
    if (existing && existing.channel === channel) return { status: "already-installed", binary: existing };
  }
  const finalPlan = buildPlan(ctx, channel, version);
  if (options.dryRun) return { status: "planned", plan: finalPlan };

  return withLock(ctx.paths.installLock, async () => {
    const staging = `${finalPlan.targetDirectory}.staging-${randomUUID()}`;
    const plan = buildPlan(ctx, channel, version, staging);
    try {
      const metadataUrl = `${REGISTRY}${encodeURIComponent(plan.packageName)}/${encodeURIComponent(plan.packageVersion)}`;
      const raw = await (dependencies.fetchMetadata ?? fetchBoundedJson)(metadataUrl);
      const metadata = validateMetadata(raw, plan);
      await ensurePrivateDirectory(staging);
      const npmCli = dependencies.npmCli ?? await findNpmCli(ctx);
      const result = await ctx.exec(process.execPath, [npmCli, ...plan.npmArguments], {
        cwd: ctx.cwd,
        env: ctx.env,
        timeoutMs: 600_000,
        maxOutputBytes: 8 * 1_024 * 1_024,
      });
      if (result.exitCode !== 0) {
        throw new AppError("INSTALL_FAILED", `npm install failed${result.timedOut ? " (timeout)" : ""}: ${(result.stderr || result.stdout || errorMessage(result.error)).trim().slice(0, 4_000)}`, EXIT.INSTALL);
      }
      const command = { file: packageBinaryPath(staging, channel, ctx.platform), source: "managed" as const };
      let binary: DetectedBinary;
      try {
        binary = await probeVersion(ctx, command);
      } catch (error) {
        throw new AppError("INSTALL_VERIFY_FAILED", `Installed binary failed verification: ${errorMessage(error)}`, EXIT.INSTALL);
      }
      if (binary.version !== version) {
        throw new AppError("INSTALL_VERSION_MISMATCH", `Expected OpenCode ${version}, got ${binary.version}`, EXIT.INSTALL);
      }
      await replaceDirectory(staging, finalPlan.targetDirectory);
      const receipt: InstallReceipt = {
        version: 1,
        channel,
        packageName: plan.packageName,
        packageVersion: version,
        binaryPath: finalPlan.binaryPath,
        integrity: metadata.integrity,
        installedAt: ctx.now().toISOString(),
      };
      await writeJsonAtomic(ctx.paths.receiptFile, receipt);
      await saveConfig(ctx, { ...config, channel });
      return { status: "installed", receipt, binary: { ...binary, file: finalPlan.binaryPath } };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("INSTALL_FAILED", `OpenCode install failed: ${errorMessage(error)}`, EXIT.INSTALL);
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    }
  }, { timeoutMs: 10_000, staleMs: 15 * 60_000 });
}

export async function ensureOpenCode(ctx: AppContext, config: NullxConfig): Promise<DetectedBinary> {
  const existing = await detectOpenCode(ctx, config);
  if (existing) return existing;
  if (!config.autoInstall || ctx.env.NULLX_NO_AUTO_INSTALL === "1") {
    throw new AppError("OPENCODE_NOT_FOUND", "OpenCode is not installed. Run nullx install, or set a binary with nullx config set binary <path>.", EXIT.NOT_FOUND);
  }
  ctx.stderr.write(`OpenCode not found. Installing the pinned official ${config.channel} CLI from npm…\n`);
  const result = await installOpenCode(ctx, config, { channel: config.channel });
  if (result.status === "planned") throw new AppError("INSTALL_FAILED", "Unexpected dry-run during auto-install", EXIT.INSTALL);
  return result.binary;
}
