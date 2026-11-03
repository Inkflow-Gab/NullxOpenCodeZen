import path from "node:path";
import { AppError, EXIT } from "./errors.js";
import type { Channel } from "./types.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const known = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new AppError("CONFIG_UNKNOWN_KEY", `${label} has unknown keys: ${unknown.join(", ")}`, EXIT.CONFIG);
  }
}

export function stringValue(value: unknown, label: string, maxLength = 4096): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AppError("CONFIG_INVALID", `${label} must be a non-empty string of at most ${maxLength} characters without control characters`, EXIT.CONFIG);
  }
  return value;
}

export function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new AppError("CONFIG_INVALID", `${label} must be true or false`, EXIT.CONFIG);
  }
  return value;
}

export function integerValue(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new AppError("CONFIG_INVALID", `${label} must be an integer from ${min} to ${max}`, EXIT.CONFIG);
  }
  return value;
}

export function channelValue(value: unknown): Channel {
  if (value !== "v1" && value !== "v2") {
    throw new AppError("CONFIG_INVALID", "channel must be v1 or v2", EXIT.CONFIG);
  }
  return value;
}

export function timezoneValue(value: unknown): string {
  const timezone = stringValue(value, "timezone", 100);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new AppError("CONFIG_INVALID", `Unknown IANA timezone: ${timezone}`, EXIT.CONFIG);
  }
  return timezone;
}

export function modelValue(value: string): string {
  const model = stringValue(value, "model", 256);
  const slash = model.indexOf("/");
  const provider = slash === -1 ? "" : model.slice(0, slash);
  const name = slash === -1 ? "" : model.slice(slash + 1);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(provider) || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,190}$/.test(name) || name.includes("..")) {
    throw new AppError("MODEL_INVALID", "Model must use provider/model, for example opencode/claude-sonnet-4-5", EXIT.CONFIG);
  }
  return model;
}

export function versionValue(value: string): string {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/.test(value) || value.length > 80) {
    throw new AppError("VERSION_INVALID", "Use an exact version such as 1.19.5, not a tag or range", EXIT.USAGE);
  }
  return value;
}

export function binaryPathValue(value: string, cwd: string, platform: NodeJS.Platform): string {
  const module = platform === "win32" ? path.win32 : path.posix;
  const cleaned = stringValue(value, "binary path");
  return module.resolve(cwd, cleaned);
}

export function parseBoolean(value: string, label: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError("USAGE", `${label} must be true or false`, EXIT.USAGE);
}

export function parseLimit(value: string, label: string): number | null {
  if (value === "unlimited") return null;
  if (!/^\d+$/.test(value)) {
    throw new AppError("USAGE", `${label} must be a non-negative integer or unlimited`, EXIT.USAGE);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > 1_000_000) {
    throw new AppError("USAGE", `${label} must be at most 1000000`, EXIT.USAGE);
  }
  return number;
}
