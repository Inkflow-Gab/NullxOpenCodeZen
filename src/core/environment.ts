import { open, type FileHandle } from "node:fs/promises";
import os from "node:os";

export interface EnvironmentInfo {
  platform: NodeJS.Platform;
  architecture: string;
  distribution: string;
  distributionId: string;
  ubuntu: boolean;
  termux: boolean;
  prootLike: boolean;
  wsl: boolean;
  androidKernel: boolean;
  nodeVersion: string;
  hints: string[];
}

export interface EnvironmentOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  architecture?: string;
  nodeVersion?: string;
  readText?: (file: string) => Promise<string>;
}

async function boundedRead(file: string, maxBytes = 65_536): Promise<string> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(file, "r");
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } catch {
    return "";
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function field(text: string, key: string): string {
  const match = new RegExp(`^${key}=(.*)$`, "m").exec(text);
  return (match?.[1] ?? "").trim().replace(/^"|"$/g, "");
}

export function environmentHints(info: Omit<EnvironmentInfo, "hints">): string[] {
  const hints: string[] = [];
  if (info.platform === "linux" && (info.termux || info.prootLike)) {
    hints.push("Mobile/proot-like session detected. Keep OpenCode open in another tmux pane or terminal session.");
    hints.push("Install and run from the Ubuntu home filesystem, not shared storage such as /sdcard.");
    if (info.ubuntu) hints.push("Use the no-sudo mobile setup in docs/MOBILE-PROOT.md.");
  }
  if (info.platform === "linux" && info.architecture === "arm") {
    hints.push("32-bit ARM may not have a supported official OpenCode binary; use arm64 or x64 when possible.");
  }
  if (info.wsl) {
    hints.push("WSL detected. Keep the OpenCode server inside the same WSL distribution as nullx.");
  }
  return hints;
}

export async function describeEnvironment(options: EnvironmentOptions = {}): Promise<EnvironmentInfo> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? os.arch();
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const readText = options.readText ?? boundedRead;

  if (platform !== "linux") {
    const base = {
      platform,
      architecture,
      distribution: os.type(),
      distributionId: "",
      ubuntu: false,
      termux: false,
      prootLike: false,
      wsl: false,
      androidKernel: false,
      nodeVersion,
    };
    return { ...base, hints: environmentHints(base) };
  }

  const [release, kernelVersion, status, cmdline] = await Promise.all([
    readText("/etc/os-release"),
    readText("/proc/version"),
    readText("/proc/self/status"),
    readText("/proc/1/cmdline"),
  ]);
  const distributionId = field(release, "ID").toLowerCase();
  const distribution = field(release, "PRETTY_NAME") || distributionId || "Linux";
  const ubuntu = distributionId === "ubuntu" || /ubuntu/i.test(distribution);
  const termux = env.TERMUX_VERSION !== undefined || (env.PREFIX?.includes("com.termux") ?? false) || env.ANDROID_ROOT !== undefined;
  const androidKernel = /android/i.test(kernelVersion);
  const wsl = /microsoft|wsl/i.test(kernelVersion);
  const tracer = /^TracerPid:\s*(\d+)/m.exec(status);
  const traced = tracer !== null && Number(tracer[1]) > 0;
  const prootCommand = /proot/i.test(cmdline);
  const prootEnv = env.PROOT_TMP_DIR !== undefined || env.PROOT_NO_SECCOMP !== undefined || env.PROOT_ROOTFS !== undefined;
  const prootLike = !wsl && (prootEnv || prootCommand || (androidKernel && ubuntu) || (termux && traced));

  const base = {
    platform,
    architecture,
    distribution,
    distributionId,
    ubuntu,
    termux,
    prootLike,
    wsl,
    androidKernel,
    nodeVersion,
  };
  return { ...base, hints: environmentHints(base) };
}

export function environmentLabel(info: EnvironmentInfo): string {
  const parts = [info.distribution, info.architecture];
  if (info.prootLike) parts.push("proot-like");
  if (info.termux) parts.push("Termux-linked");
  if (info.wsl) parts.push("WSL");
  return parts.filter(Boolean).join(" · ");
}
