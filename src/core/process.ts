import { spawn } from "node:child_process";
import os from "node:os";
import { AppError, EXIT, errorMessage } from "./errors.js";
import type { ExecOptions, ExecResult } from "./types.js";

function asErrno(error: unknown): NodeJS.ErrnoException {
  return error instanceof Error ? error as NodeJS.ErrnoException : new Error(String(error));
}

export const execute: (file: string, args: readonly string[], options?: ExecOptions) => Promise<ExecResult> = async (file, args, options = {}) => {
  const maxBytes = options.maxOutputBytes ?? 1_048_576;
  const timeoutMs = options.timeoutMs ?? 15_000;
  return new Promise((resolve) => {
    const child = spawn(file, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let outputExceeded = false;
    let settled = false;
    let killTimer: NodeJS.Timeout | undefined;
    const timer = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
    }, timeoutMs) : undefined;

    const finish = (result: ExecResult): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve(result);
    };
    const collect = (chunks: Buffer[], chunk: Buffer, stream: "stdout" | "stderr"): void => {
      const used = stream === "stdout" ? stdoutBytes : stderrBytes;
      const remaining = Math.max(0, maxBytes - used);
      const kept = chunk.subarray(0, remaining);
      chunks.push(kept);
      if (stream === "stdout") stdoutBytes += kept.length;
      else stderrBytes += kept.length;
      if (chunk.length > remaining && !outputExceeded) {
        outputExceeded = true;
        child.kill("SIGTERM");
        killTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
      }
    };
    child.stdout?.on("data", (chunk: Buffer) => collect(stdout, chunk, "stdout"));
    child.stderr?.on("data", (chunk: Buffer) => collect(stderr, chunk, "stderr"));
    child.on("error", (error) => finish({ exitCode: null, signal: null, stdout: "", stderr: "", timedOut, error: asErrno(error) }));
    child.on("close", (exitCode, signal) => {
      const error = outputExceeded ? Object.assign(new Error("Process output exceeded the capture limit"), { code: "OUTPUT_LIMIT" }) : undefined;
      finish({ exitCode, signal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), timedOut, ...(error ? { error } : {}) });
    });
  });
};

export async function runInherited(
  file: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<{ exitCode: number; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, [...args], { cwd: options.cwd, env: options.env, shell: false, windowsHide: true, stdio: "inherit" });
    const signals: NodeJS.Signals[] = process.platform === "win32" ? ["SIGINT", "SIGTERM", "SIGBREAK"] : ["SIGINT", "SIGTERM", "SIGHUP"];
    const handlers = new Map<NodeJS.Signals, () => void>();
    const cleanup = (): void => {
      for (const [signal, handler] of handlers) process.off(signal, handler);
    };
    for (const signal of signals) {
      const handler = (): void => { child.kill(signal); };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    child.once("error", (error) => {
      cleanup();
      reject(new AppError("SPAWN_FAILED", `Cannot start ${file}: ${errorMessage(error)}`, EXIT.UPSTREAM));
    });
    child.once("close", (code, signal) => {
      cleanup();
      const signalNumber = signal ? os.constants.signals[signal] ?? 0 : 0;
      resolve({ exitCode: code ?? Math.min(255, 128 + signalNumber), signal });
    });
  });
}
