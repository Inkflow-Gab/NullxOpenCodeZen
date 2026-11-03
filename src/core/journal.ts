import { appendFile, readFile, stat } from "node:fs/promises";
import { AppError, EXIT, errorMessage } from "./errors.js";
import { writeTextAtomic } from "./json.js";
import { ensurePrivateDirectory } from "./paths.js";
import type { JournalEvent, Paths } from "./types.js";

const MAX_JOURNAL_BYTES = 64 * 1_024 * 1_024;
const MAX_LINE_BYTES = 16 * 1_024;
const MAX_EVENTS = 1_000_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80 && /^[\w-]+$/.test(value);
}

export function validateEvent(value: unknown): JournalEvent {
  if (typeof value !== "object" || value === null) throw new Error("event is not an object");
  const event = value as Record<string, unknown>;
  if (!validId(event.id) || !validDate(event.at) || typeof event.day !== "string" || !DAY.test(event.day)) {
    throw new Error("event identity or timestamp is invalid");
  }
  const base = { id: event.id, at: event.at, day: event.day };
  if (event.type === "reset") return { ...base, type: "reset" };
  if (event.type === "launch") {
    if ((event.kind !== "run" && event.kind !== "session") || !(event.model === null || (typeof event.model === "string" && event.model.length <= 256 && !/[\u0000-\u001f]/.test(event.model)))) {
      throw new Error("launch event is invalid");
    }
    return { ...base, type: "launch", kind: event.kind, model: event.model };
  }
  if (event.type === "finish") {
    if (typeof event.exitCode !== "number" || !Number.isInteger(event.exitCode) || event.exitCode < 0 || event.exitCode > 255 ||
        typeof event.durationMs !== "number" || !Number.isSafeInteger(event.durationMs) || event.durationMs < 0 ||
        !(event.signal === null || (typeof event.signal === "string" && /^SIG[A-Z0-9]+$/.test(event.signal)))) {
      throw new Error("finish event is invalid");
    }
    return { ...base, type: "finish", exitCode: event.exitCode, durationMs: event.durationMs, signal: event.signal as NodeJS.Signals | null };
  }
  throw new Error("unknown event type");
}

export async function readJournal(paths: Paths): Promise<JournalEvent[]> {
  try {
    const info = await stat(paths.journalFile);
    if (info.size > MAX_JOURNAL_BYTES) {
      throw new AppError("JOURNAL_TOO_LARGE", `Usage journal exceeds ${MAX_JOURNAL_BYTES} bytes; archive it before continuing.`, EXIT.FAILURE);
    }
    const text = await readFile(paths.journalFile, "utf8");
    const lines = text.split("\n");
    const events: JournalEvent[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (line.trim() === "") continue;
      if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES || events.length >= MAX_EVENTS) {
        throw new AppError("JOURNAL_LIMIT", "Usage journal contains an oversized record or too many records", EXIT.FAILURE);
      }
      try {
        events.push(validateEvent(JSON.parse(line)));
      } catch (error) {
        throw new AppError("JOURNAL_CORRUPT", `Usage journal line ${index + 1} is invalid: ${errorMessage(error)}. Budget enforcement is paused rather than silently reset.`, EXIT.FAILURE);
      }
    }
    return events;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    if (error instanceof AppError) throw error;
    throw new AppError("JOURNAL_READ_FAILED", `Cannot read usage journal: ${errorMessage(error)}`, EXIT.FAILURE);
  }
}

/** Call while holding the journal lock. */
export async function appendEvent(paths: Paths, event: JournalEvent): Promise<void> {
  await ensurePrivateDirectory(paths.stateDir);
  await appendFile(paths.journalFile, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
}

/** Keep all of today's records; bound older history separately. Call under lock. */
export async function compactJournal(paths: Paths, currentDay: string, historyLimit: number): Promise<number> {
  const events = await readJournal(paths);
  const today = events.filter((event) => event.day === currentDay);
  const older = events.filter((event) => event.day !== currentDay);
  if (older.length <= historyLimit) return 0;
  const kept = [...older.slice(-historyLimit), ...today];
  await writeTextAtomic(paths.journalFile, kept.map((event) => JSON.stringify(event)).join("\n") + "\n");
  return older.length - historyLimit;
}
