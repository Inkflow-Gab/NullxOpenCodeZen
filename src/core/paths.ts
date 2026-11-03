import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Channel, Paths } from "./types.js";

export const APP_DIRECTORY = "nullx-opencode-zen";

export const RELEASES: Record<Channel, { packageName: string; version: string; integrity: string }> = {
  v1: {
    packageName: "opencode-ai",
    version: "1.19.5",
    integrity: "sha512-tEqMvQahfhdDj8vceYpXtoIrvjPXm5XRfetWnPN5YISueU7adNx9JcUA3zZ+2GKuDVgDpGdQe1ZLtCZDjqodvA==",
  },
  v2: {
    packageName: "@opencode/cli",
    version: "2.2.5",
    integrity: "sha512-sJAwrwuVa5b+pA3O1UOiSDcC9DgdPVmtkWv6aF6q3+rOiOTCqrE41tkz1kyyE2O8BYPs4eOvBuzkQ6oEm8w5Mw==",
  },
};

interface PathInput {
  homeDir: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  cwd: string;
}

function absoluteOrFallback(value: string | undefined, fallback: string, module: typeof path.posix): string {
  return value && module.isAbsolute(value) ? value : fallback;
}

export function createPaths(input: PathInput): Paths {
  const module = input.platform === "win32" ? path.win32 : path.posix;
  const join = module.join.bind(module);
  const override = input.env.NULLX_HOME?.trim();
  let configDir: string;
  let stateDir: string;
  let dataDir: string;

  if (override) {
    const root = module.resolve(input.cwd, override);
    configDir = root;
    stateDir = join(root, "state");
    dataDir = join(root, "data");
  } else if (input.platform === "win32") {
    const roaming = absoluteOrFallback(input.env.APPDATA, join(input.homeDir, "AppData", "Roaming"), module);
    const local = absoluteOrFallback(input.env.LOCALAPPDATA, join(input.homeDir, "AppData", "Local"), module);
    configDir = join(roaming, APP_DIRECTORY);
    stateDir = join(local, APP_DIRECTORY, "state");
    dataDir = join(local, APP_DIRECTORY, "data");
  } else if (input.platform === "darwin") {
    const base = join(input.homeDir, "Library", "Application Support", APP_DIRECTORY);
    configDir = join(base, "config");
    stateDir = join(base, "state");
    dataDir = join(base, "data");
  } else {
    const configHome = absoluteOrFallback(input.env.XDG_CONFIG_HOME, join(input.homeDir, ".config"), module);
    const stateHome = absoluteOrFallback(input.env.XDG_STATE_HOME, join(input.homeDir, ".local", "state"), module);
    const dataHome = absoluteOrFallback(input.env.XDG_DATA_HOME, join(input.homeDir, ".local", "share"), module);
    configDir = join(configHome, APP_DIRECTORY);
    stateDir = join(stateHome, APP_DIRECTORY);
    dataDir = join(dataHome, APP_DIRECTORY);
  }

  return {
    configDir,
    stateDir,
    dataDir,
    configFile: join(configDir, "config.json"),
    journalFile: join(stateDir, "usage.jsonl"),
    journalLock: join(stateDir, "usage.lock"),
    installLock: join(dataDir, "install.lock"),
    receiptFile: join(dataDir, "receipt.json"),
    installsDir: join(dataDir, "installs"),
  };
}

export function installDirectory(paths: Paths, channel: Channel, version: string, platform: NodeJS.Platform): string {
  const module = platform === "win32" ? path.win32 : path.posix;
  return module.join(paths.installsDir, channel, version);
}

export function packageBinaryPath(prefix: string, channel: Channel, platform: NodeJS.Platform): string {
  const module = platform === "win32" ? path.win32 : path.posix;
  // Both official npm packages copy the native platform binary to this filename,
  // including on Linux and macOS. Spawning it directly avoids npm shell shims.
  return module.join(prefix, "node_modules", ...RELEASES[channel].packageName.split("/"), "bin", "opencode.exe");
}

export function managedBinaryPath(
  paths: Paths,
  channel: Channel,
  version: string,
  platform: NodeJS.Platform,
): string {
  return packageBinaryPath(installDirectory(paths, channel, version, platform), channel, platform);
}

export async function ensurePrivateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
}
