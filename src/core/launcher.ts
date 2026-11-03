import { chmod, lstat, mkdir, readFile, readlink, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, EXIT, errorMessage } from "./errors.js";
import type { AppContext } from "./types.js";

/** Stable marker so setup can recognise launchers it created earlier. */
export const LAUNCHER_MARKER = "nullx-opencode-zen-launcher";
export const PATH_MARKER = "nullx-opencode-zen PATH";
export const DEFAULT_COMMAND = "nullx";
export const FALLBACK_COMMAND = "nullx-zen";

export type LauncherOwner = "missing" | "ours" | "foreign";

export interface LauncherTarget {
  name: string;
  file: string;
  owner: LauncherOwner;
  detail: string;
}

export interface LauncherOptions {
  /** Command name to install. When omitted, setup picks a free name. */
  name?: string;
  binDir?: string;
  entryPoint?: string;
  nodePath?: string;
  force?: boolean;
  updatePath?: boolean;
}

export interface LauncherResult {
  name: string;
  file: string;
  binDir: string;
  action: "created" | "updated" | "replaced-foreign" | "unchanged";
  backup?: string;
  renamedFrom?: string;
  pathUpdated: string[];
  pathAlreadyPresent: boolean;
}

function moduleFor(platform: NodeJS.Platform): typeof path.posix {
  return platform === "win32" ? path.win32 : path.posix;
}

export function defaultBinDir(ctx: AppContext): string {
  const module = moduleFor(ctx.platform);
  if (ctx.platform === "win32") {
    const local = ctx.env.LOCALAPPDATA;
    const base = local && module.isAbsolute(local) ? local : module.join(ctx.homeDir, "AppData", "Local");
    return module.join(base, "nullx-opencode-zen", "bin");
  }
  return module.join(ctx.homeDir, ".local", "bin");
}

export function launcherFileName(name: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? `${name}.cmd` : name;
}

export function defaultEntryPoint(): string {
  // dist/core/launcher.js -> dist/cli.js
  return fileURLToPath(new URL("../cli.js", import.meta.url));
}

export function renderLauncher(entryPoint: string, nodePath: string, platform: NodeJS.Platform): string {
  if (platform === "win32") {
    return `@echo off\r\nrem ${LAUNCHER_MARKER}\r\n"${nodePath}" "${entryPoint}" %*\r\n`;
  }
  const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
  return [
    "#!/bin/sh",
    `# ${LAUNCHER_MARKER}`,
    `NODE=${quote(nodePath)}`,
    '[ -x "$NODE" ] || NODE=node',
    `exec "$NODE" ${quote(entryPoint)} "$@"`,
    "",
  ].join("\n");
}

/** Classify an existing file so setup never silently clobbers another tool. */
export async function inspectLauncher(file: string, entryPoint: string): Promise<LauncherTarget & { name: string }> {
  const name = path.basename(file);
  let info;
  try {
    info = await lstat(file);
  } catch {
    return { name, file, owner: "missing", detail: "No command with this name exists yet" };
  }
  if (info.isSymbolicLink()) {
    try {
      const link = await readlink(file);
      const resolved = path.resolve(path.dirname(file), link);
      if (resolved === entryPoint || resolved.includes("nullx-opencode-zen")) {
        return { name, file, owner: "ours", detail: `Existing symlink to ${resolved}` };
      }
      return { name, file, owner: "foreign", detail: `Symlink to another program: ${resolved}` };
    } catch (error) {
      return { name, file, owner: "foreign", detail: `Unreadable symlink: ${errorMessage(error)}` };
    }
  }
  if (!info.isFile()) return { name, file, owner: "foreign", detail: "Path exists but is not a regular file" };
  try {
    const text = await readFile(file, "utf8");
    if (text.includes(LAUNCHER_MARKER)) return { name, file, owner: "ours", detail: "Launcher created by this project" };
    if (text.includes(entryPoint)) return { name, file, owner: "ours", detail: "Launcher already points at this build" };
    const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
    return { name, file, owner: "foreign", detail: `Another program owns this command (${firstLine.slice(0, 80)})` };
  } catch (error) {
    return { name, file, owner: "foreign", detail: `Cannot read existing command: ${errorMessage(error)}` };
  }
}

async function firstFreeName(ctx: AppContext, binDir: string, entryPoint: string): Promise<{ name: string; renamedFrom?: string }> {
  const candidates = [DEFAULT_COMMAND, FALLBACK_COMMAND, `${FALLBACK_COMMAND}-2`, `${FALLBACK_COMMAND}-3`];
  for (const [index, name] of candidates.entries()) {
    const target = await inspectLauncher(path.join(binDir, launcherFileName(name, ctx.platform)), entryPoint);
    if (target.owner !== "foreign") {
      return index === 0 ? { name } : { name, renamedFrom: DEFAULT_COMMAND };
    }
  }
  throw new AppError(
    "LAUNCHER_NAME_TAKEN",
    `Every default command name is taken in ${binDir}. Choose one with: nullx setup --name <command>`,
    EXIT.CONFIG,
  );
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Persist the user-scope PATH on Windows without admin rights. */
async function ensureWindowsPath(ctx: AppContext, binDir: string): Promise<string[]> {
  const escaped = binDir.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$dir = '${escaped}'`,
    "$current = [Environment]::GetEnvironmentVariable('Path', 'User')",
    "if ($null -eq $current) { $current = '' }",
    "$parts = $current.Split(';') | Where-Object { $_ -ne '' }",
    "if ($parts -contains $dir) { Write-Output 'present'; exit 0 }",
    "$next = if ($current.TrimEnd(';') -eq '') { $dir } else { $current.TrimEnd(';') + ';' + $dir }",
    "[Environment]::SetEnvironmentVariable('Path', $next, 'User')",
    "Write-Output 'updated'",
  ].join("; ");
  const result = await ctx.exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { timeoutMs: 20_000 });
  if (result.exitCode !== 0) {
    throw new AppError(
      "PATH_UPDATE_FAILED",
      `Could not update the user PATH automatically. Add this directory to PATH manually: ${binDir}`,
      EXIT.CONFIG,
    );
  }
  return result.stdout.trim() === "updated" ? ["HKCU\\Environment:Path"] : [];
}

async function ensurePath(ctx: AppContext, binDir: string): Promise<{ updated: string[]; alreadyPresent: boolean }> {
  const module = moduleFor(ctx.platform);
  const pathValue = ctx.env.PATH ?? ctx.env.Path ?? "";
  const alreadyPresent = pathValue.split(module.delimiter).includes(binDir);
  if (ctx.platform === "win32") {
    try {
      return { updated: await ensureWindowsPath(ctx, binDir), alreadyPresent };
    } catch (error) {
      // A locked-down machine must still get a working launcher.
      process.emitWarning(errorMessage(error));
      return { updated: [], alreadyPresent };
    }
  }

  const updated: string[] = [];
  const snippet = `\n# ${PATH_MARKER}\nexport PATH=${shellQuote(binDir)}:"$PATH"\n`;
  for (const file of [module.join(ctx.homeDir, ".bashrc"), module.join(ctx.homeDir, ".profile")]) {
    try {
      const existing = await readFile(file, "utf8").catch(() => "");
      if (existing.includes(PATH_MARKER)) continue;
      await writeFile(file, existing + snippet, { encoding: "utf8", mode: 0o644 });
      updated.push(file);
    } catch {
      // A read-only or missing shell config must not fail setup.
    }
  }
  return { updated, alreadyPresent };
}

export async function installLauncher(ctx: AppContext, options: LauncherOptions = {}): Promise<LauncherResult> {
  const entryPoint = options.entryPoint ?? defaultEntryPoint();
  const nodePath = options.nodePath ?? process.execPath;
  // Filesystem joins use the host path module: these paths are really written to disk.
  // The platform module only decides launcher syntax, file suffix, and PATH delimiters.
  const binDir = options.binDir ? path.resolve(ctx.cwd, options.binDir) : defaultBinDir(ctx);
  const force = options.force ?? false;

  let renamedFrom: string | undefined;
  let name = options.name;
  if (name !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new AppError("LAUNCHER_NAME_INVALID", `Invalid command name: ${name}`, EXIT.USAGE);
  }
  if (name === undefined) {
    const picked = await firstFreeName(ctx, binDir, entryPoint);
    name = picked.name;
    renamedFrom = picked.renamedFrom;
  }

  const file = path.join(binDir, launcherFileName(name, ctx.platform));
  const target = await inspectLauncher(file, entryPoint);
  if (target.owner === "foreign" && !force) {
    throw new AppError(
      "LAUNCHER_CONFLICT",
      `${file} belongs to another program. ${target.detail}. ` +
        `Run: node dist/cli.js setup --name ${FALLBACK_COMMAND}  (keeps both tools), ` +
        `or node dist/cli.js setup --name ${name} --force (backs up the other command first).`,
      EXIT.CONFIG,
    );
  }

  await mkdir(binDir, { recursive: true, mode: 0o755 });
  const content = renderLauncher(entryPoint, nodePath, ctx.platform);
  const previous = target.owner === "missing" ? undefined : await readFile(file, "utf8").catch(() => undefined);

  let backup: string | undefined;
  if (target.owner === "foreign") {
    backup = `${file}.backup-${ctx.now().toISOString().replace(/[:.]/g, "-")}`;
    await rename(file, backup);
  }

  if (previous === content && target.owner === "ours") {
    const pathInfo = options.updatePath === false ? { updated: [], alreadyPresent: true } : await ensurePath(ctx, binDir);
    return {
      name,
      file,
      binDir,
      action: "unchanged",
      ...(renamedFrom ? { renamedFrom } : {}),
      pathUpdated: pathInfo.updated,
      pathAlreadyPresent: pathInfo.alreadyPresent,
    };
  }

  await writeFile(file, content, { encoding: "utf8", mode: 0o755 });
  if (ctx.platform !== "win32") await chmod(file, 0o755);
  const pathInfo = options.updatePath === false ? { updated: [], alreadyPresent: true } : await ensurePath(ctx, binDir);
  return {
    name,
    file,
    binDir,
    action: target.owner === "missing" ? "created" : target.owner === "foreign" ? "replaced-foreign" : "updated",
    ...(backup ? { backup } : {}),
    ...(renamedFrom ? { renamedFrom } : {}),
    pathUpdated: pathInfo.updated,
    pathAlreadyPresent: pathInfo.alreadyPresent,
  };
}

export interface CommandConflict {
  command: string;
  file: string;
  owner: LauncherOwner;
  detail: string;
}

/** Find which `nullx` the shell would actually run, so doctor can explain PATH shadowing. */
export async function findCommandConflict(
  ctx: AppContext,
  command = DEFAULT_COMMAND,
  entryPoint = defaultEntryPoint(),
): Promise<CommandConflict | null> {
  const module = moduleFor(ctx.platform);
  const directories = (ctx.env.PATH ?? ctx.env.Path ?? "").split(module.delimiter).filter(Boolean).slice(0, 256);
  const extensions = ctx.platform === "win32" ? [".cmd", ".exe", ".bat"] : [""];
  for (const directory of directories) {
    for (const extension of extensions) {
      const file = module.join(directory, `${command}${extension}`);
      try {
        await lstat(file);
      } catch {
        continue;
      }
      const target = await inspectLauncher(file, entryPoint);
      return { command, file, owner: target.owner, detail: target.detail };
    }
  }
  return null;
}
