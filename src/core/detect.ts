import { access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { AppError, EXIT, errorMessage } from "./errors.js";
import { readJsonFile } from "./json.js";
import { RELEASES } from "./paths.js";
import type { AppContext, BinaryCommand, BinarySource, DetectedBinary, DetectionCandidate, DetectionReport, InstallReceipt, NullxConfig } from "./types.js";
import { isRecord, stringValue } from "./validation.js";

async function executable(file: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    await access(file, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function nativeShim(file: string, platform: NodeJS.Platform): Promise<string | undefined> {
  if (platform !== "win32" || !/\.(cmd|bat)$/i.test(file)) return file;
  const directory = path.dirname(file);
  for (const release of Object.values(RELEASES)) {
    const candidate = path.join(directory, "node_modules", ...release.packageName.split("/"), "bin", "opencode.exe");
    if (await executable(candidate, platform)) return candidate;
  }
  return undefined;
}

export async function resolveExplicitBinary(file: string, source: BinarySource, platform: NodeJS.Platform): Promise<BinaryCommand> {
  const native = await nativeShim(file, platform);
  if (!native || !await executable(native, platform)) {
    throw new AppError("BINARY_NOT_FOUND", `${source} OpenCode binary is not executable: ${file}. Use the native opencode executable or run nullx install.`, EXIT.NOT_FOUND);
  }
  return { file: native, source };
}

export async function pathCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<BinaryCommand[]> {
  const module = platform === "win32" ? path.win32 : path.posix;
  const directories = (env.PATH ?? env.Path ?? "").split(module.delimiter).filter(Boolean).slice(0, 256);
  const extensions = platform === "win32"
    ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean).slice(0, 16)
    : [""];
  const result: BinaryCommand[] = [];
  const seen = new Set<string>();
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = module.join(directory, `opencode${extension.toLowerCase()}`);
      const native = await nativeShim(candidate, platform);
      if (!native || seen.has(native) || !await executable(native, platform)) continue;
      seen.add(native);
      result.push({ file: native, source: "path" });
    }
  }
  return result;
}

export async function readReceipt(ctx: AppContext): Promise<InstallReceipt | undefined> {
  const raw = await readJsonFile(ctx.paths.receiptFile);
  if (raw === undefined) return undefined;
  if (!isRecord(raw) || raw.version !== 1 || (raw.channel !== "v1" && raw.channel !== "v2")) {
    throw new AppError("RECEIPT_INVALID", `Invalid install receipt: ${ctx.paths.receiptFile}`, EXIT.INSTALL);
  }
  const packageName = stringValue(raw.packageName, "receipt.packageName", 100);
  const packageVersion = stringValue(raw.packageVersion, "receipt.packageVersion", 80);
  const binaryPath = stringValue(raw.binaryPath, "receipt.binaryPath");
  const integrity = stringValue(raw.integrity, "receipt.integrity", 200);
  const installedAt = stringValue(raw.installedAt, "receipt.installedAt", 40);
  const module = ctx.platform === "win32" ? path.win32 : path.posix;
  if (packageName !== RELEASES[raw.channel].packageName || !module.isAbsolute(binaryPath)) {
    throw new AppError("RECEIPT_INVALID", "Install receipt does not describe an official managed binary", EXIT.INSTALL);
  }
  return { version: 1, channel: raw.channel, packageName, packageVersion, binaryPath, integrity, installedAt };
}

export function parseVersion(output: string): string | undefined {
  return /\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?)\b/.exec(output)?.[1];
}

export async function probeVersion(ctx: AppContext, command: BinaryCommand): Promise<DetectedBinary> {
  const result = await ctx.exec(command.file, ["--version"], { cwd: ctx.cwd, env: ctx.env, timeoutMs: 10_000, maxOutputBytes: 65_536 });
  const version = parseVersion(`${result.stdout}\n${result.stderr}`);
  if (result.exitCode !== 0 || !version) {
    const detail = (result.stderr || result.stdout || result.error?.message || (result.timedOut ? "timed out" : "no version output")).trim().slice(0, 500);
    throw new AppError("BINARY_PROBE_FAILED", `OpenCode at ${command.file} did not return a valid version (exit ${result.exitCode ?? "null"}): ${detail}`, EXIT.NOT_FOUND);
  }
  const major = Number(version.split(".")[0]);
  return { ...command, version, channel: major === 1 ? "v1" : major === 2 ? "v2" : "unknown" };
}

export async function detectOpenCode(ctx: AppContext, config: NullxConfig): Promise<DetectedBinary | null> {
  const environmental = ctx.env.NULLX_OPENCODE_BINARY?.trim();
  if (environmental) {
    const module = ctx.platform === "win32" ? path.win32 : path.posix;
    return probeVersion(ctx, await resolveExplicitBinary(module.resolve(ctx.cwd, environmental), "environment", ctx.platform));
  }
  if (config.binaryPath) return probeVersion(ctx, await resolveExplicitBinary(config.binaryPath, "config", ctx.platform));
  try {
    const receipt = await readReceipt(ctx);
    if (receipt && await executable(receipt.binaryPath, ctx.platform)) {
      return await probeVersion(ctx, { file: receipt.binaryPath, source: "managed" });
    }
  } catch {
    // A stale or damaged managed receipt must not hide a working PATH install.
  }
  for (const candidate of await pathCandidates(ctx.env, ctx.platform)) {
    try {
      return await probeVersion(ctx, candidate);
    } catch {
      continue;
    }
  }
  return null;
}

export async function inspectOpenCode(ctx: AppContext, config: NullxConfig): Promise<DetectionReport> {
  const candidates: DetectionCandidate[] = [];
  const warnings: string[] = [];
  const state: { selected: DetectedBinary | null } = { selected: null };

  const consider = async (command: BinaryCommand, reason: string): Promise<void> => {
    try {
      const probed = await probeVersion(ctx, command);
      const isSelected = state.selected === null;
      candidates.push({ ...probed, status: "ok", reason: isSelected ? reason : "lower precedence", selected: isSelected });
      if (isSelected) state.selected = probed;
    } catch (error) {
      candidates.push({ file: command.file, source: command.source, status: "error", reason, detail: errorMessage(error) });
    }
  };

  const environmental = ctx.env.NULLX_OPENCODE_BINARY?.trim();
  if (environmental) {
    const module = ctx.platform === "win32" ? path.win32 : path.posix;
    try {
      const command = await resolveExplicitBinary(module.resolve(ctx.cwd, environmental), "environment", ctx.platform);
      await consider(command, "NULLX_OPENCODE_BINARY override");
    } catch (error) {
      candidates.push({ file: environmental, source: "environment", status: "error", reason: "NULLX_OPENCODE_BINARY override", detail: errorMessage(error) });
    }
    if (!state.selected) warnings.push("The explicit environment binary is broken; lower-precedence installs are not used while it is set.");
  } else if (config.binaryPath) {
    try {
      const command = await resolveExplicitBinary(config.binaryPath, "config", ctx.platform);
      await consider(command, "config binaryPath override");
    } catch (error) {
      candidates.push({ file: config.binaryPath, source: "config", status: "error", reason: "config binaryPath override", detail: errorMessage(error) });
    }
    if (!state.selected) warnings.push("The configured binary is broken; unset it with nullx config unset binary or repair the install.");
  } else {
    try {
      const receipt = await readReceipt(ctx);
      if (receipt) {
        if (await executable(receipt.binaryPath, ctx.platform)) {
          await consider({ file: receipt.binaryPath, source: "managed" }, "managed install receipt");
        } else {
          candidates.push({ file: receipt.binaryPath, source: "managed", status: "error", reason: "managed install receipt", detail: "Receipt points to a missing or non-executable file" });
          warnings.push("The managed receipt is stale. Run nullx install --repair.");
        }
      }
    } catch (error) {
      warnings.push(`Managed receipt could not be read: ${errorMessage(error)}`);
    }
    const pathBinaries = await pathCandidates(ctx.env, ctx.platform);
    for (const candidate of pathBinaries.slice(0, 16)) {
      await consider(candidate, state.selected ? "PATH candidate" : "first working PATH candidate");
    }
    if (pathBinaries.length > 16) warnings.push(`Only the first 16 PATH candidates were inspected (${pathBinaries.length} found).`);
  }

  const working = candidates.filter((candidate) => candidate.status === "ok");
  const channels = new Set(working.map((candidate) => candidate.channel).filter((channel) => channel === "v1" || channel === "v2"));
  if (channels.size > 1) warnings.push("Both v1 and v2 OpenCode binaries are visible. Nullx keeps managed channels separate, but PATH order still matters.");
  const selected = state.selected;
  if (selected && selected.channel !== "unknown" && selected.channel !== config.channel) {
    warnings.push(`Selected OpenCode ${selected.version} is ${selected.channel}, while the configured install channel is ${config.channel}.`);
  }
  return { selected, candidates, warnings };
}
