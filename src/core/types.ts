import type { Writable } from "node:stream";

export type Channel = "v1" | "v2";
export type LaunchKind = "run" | "session";
export type BinarySource = "environment" | "config" | "managed" | "path";

export interface BudgetConfig {
  /** null means no local limit; zero blocks launches. */
  runsPerDay: number | null;
  sessionsPerDay: number | null;
  warnAtPercent: number;
}

export interface NullxConfig {
  version: 1;
  channel: Channel;
  binaryPath: string | null;
  defaultModel: string | null;
  autoInstall: boolean;
  timezone: string;
  historyLimit: number;
  budget: BudgetConfig;
}

export interface Paths {
  configDir: string;
  stateDir: string;
  dataDir: string;
  configFile: string;
  journalFile: string;
  journalLock: string;
  installLock: string;
  receiptFile: string;
  installsDir: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface ExecResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: NodeJS.ErrnoException;
}

export type Executor = (
  file: string,
  args: readonly string[],
  options?: ExecOptions,
) => Promise<ExecResult>;

export interface AppContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  homeDir: string;
  stdout: Writable;
  stderr: Writable;
  now: () => Date;
  paths: Paths;
  exec: Executor;
}

export interface BinaryCommand {
  file: string;
  source: BinarySource;
}

export interface DetectedBinary extends BinaryCommand {
  version: string;
  channel: Channel | "unknown";
}

export interface DetectionCandidate {
  file: string;
  source: BinarySource;
  status: "ok" | "error";
  reason: string;
  version?: string;
  channel?: Channel | "unknown";
  detail?: string;
  selected?: boolean;
}

export interface DetectionReport {
  selected: DetectedBinary | null;
  candidates: DetectionCandidate[];
  warnings: string[];
}

export interface InstallReceipt {
  version: 1;
  channel: Channel;
  packageName: string;
  packageVersion: string;
  binaryPath: string;
  integrity: string;
  installedAt: string;
}

export interface LaunchEvent {
  type: "launch";
  id: string;
  at: string;
  day: string;
  kind: LaunchKind;
  model: string | null;
}

export interface FinishEvent {
  type: "finish";
  id: string;
  at: string;
  day: string;
  exitCode: number;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

export interface ResetEvent {
  type: "reset";
  id: string;
  at: string;
  day: string;
}

export type JournalEvent = LaunchEvent | FinishEvent | ResetEvent;

export interface BudgetSnapshot {
  day: string;
  timezone: string;
  resetsAt: string;
  runs: number;
  sessions: number;
  runLimit: number | null;
  sessionLimit: number | null;
  runsRemaining: number | null;
  sessionsRemaining: number | null;
  completed: number;
  failed: number;
  warnAtPercent: number;
}
