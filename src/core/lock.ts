import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError, EXIT, errorMessage } from "./errors.js";
import { ensurePrivateDirectory } from "./paths.js";

interface LockOptions {
  timeoutMs?: number;
  staleMs?: number;
}

interface Owner {
  token: string;
  pid: number;
  hostname: string;
  createdAt: string;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function readOwner(lock: string): Promise<Owner | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(lock, "owner.json"), "utf8"));
    if (typeof value !== "object" || value === null) return undefined;
    const owner = value as Record<string, unknown>;
    if (typeof owner.token !== "string" || typeof owner.pid !== "number" || typeof owner.hostname !== "string" || typeof owner.createdAt !== "string") return undefined;
    return owner as unknown as Owner;
  } catch {
    return undefined;
  }
}

async function removeAbandonedLock(lock: string, staleMs: number): Promise<boolean> {
  try {
    const info = await stat(lock);
    if (Date.now() - info.mtimeMs < staleMs) return false;
    const owner = await readOwner(lock);
    if (owner && owner.hostname === os.hostname() && isProcessAlive(owner.pid)) return false;
    if (owner && owner.hostname !== os.hostname()) return false;
    await rm(lock, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function withLock<T>(lock: string, operation: () => Promise<T>, options: LockOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const staleMs = options.staleMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;
  const owner: Owner = { token: randomUUID(), pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() };
  await ensurePrivateDirectory(path.dirname(lock));
  let acquired = false;
  let delay = 25;

  while (!acquired) {
    try {
      await mkdir(lock);
      acquired = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw new AppError("LOCK_FAILED", `Cannot acquire ${lock}: ${errorMessage(error)}`, EXIT.LOCK);
      }
      await removeAbandonedLock(lock, staleMs);
      if (Date.now() >= deadline) {
        throw new AppError("LOCK_TIMEOUT", `Timed out waiting for ${lock}. Another nullx process may be writing.`, EXIT.LOCK);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 250);
    }
  }

  try {
    await writeFile(path.join(lock, "owner.json"), `${JSON.stringify(owner)}\n`, { mode: 0o600 });
    return await operation();
  } finally {
    const current = await readOwner(lock);
    if (current?.token === owner.token) {
      await rm(lock, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
