import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AppContext, Channel, NullxConfig } from "./types.js";

/**
 * OpenCode v1 and v2 share one SQLite file but use incompatible session tables.
 * v1 expects `session`; v2 renames it to `session_v2`. When a v1 binary opens a
 * v2 database it dies with "Database is not empty and has no session table".
 *
 * This module inspects the schema read-only and, in `auto` mode, gives the
 * mismatched channel its own database file instead of failing. Nothing here
 * ever writes to, migrates, or deletes an OpenCode database.
 */

export type SchemaGeneration = "empty" | "v1" | "v2" | "unknown";
export type DatabaseMode = "auto" | "shared" | "channel";

export interface DatabaseInfo {
  file: string;
  exists: boolean;
  sizeBytes: number;
  generation: SchemaGeneration;
  tables: string[];
  method: "sqlite" | "scan" | "none";
  error?: string;
}

export interface DatabaseDecision {
  /** The shared database OpenCode would open by default. */
  shared: DatabaseInfo;
  /** Database actually used for this launch, when it differs from the default. */
  effectiveFile: string;
  /** True when OPENCODE_DB must be set to keep the channels apart. */
  isolated: boolean;
  compatible: boolean;
  reason: string;
  /** Actionable advice when the shared database cannot be used as-is. */
  suggestion?: string;
}

function moduleFor(platform: NodeJS.Platform): typeof path.posix {
  return platform === "win32" ? path.win32 : path.posix;
}

/** OpenCode uses XDG-style data paths on every platform, including Windows. */
export function openCodeDataDir(ctx: AppContext): string {
  const module = moduleFor(ctx.platform);
  const override = ctx.env.XDG_DATA_HOME?.trim();
  const base = override && module.isAbsolute(override) ? override : module.join(ctx.homeDir, ".local", "share");
  return module.join(base, "opencode");
}

export function sharedDatabaseFile(ctx: AppContext): string {
  const module = moduleFor(ctx.platform);
  const data = openCodeDataDir(ctx);
  const override = ctx.env.OPENCODE_DB?.trim();
  if (!override) return module.join(data, "opencode.db");
  return override === ":memory:" ? override : module.resolve(data, override);
}

/** Per-channel file so a v1 wrapper never opens a v2 database. */
export function channelDatabaseFile(ctx: AppContext, channel: Channel): string {
  return moduleFor(ctx.platform).join(openCodeDataDir(ctx), `opencode-nullx-${channel}.db`);
}

export function generationForChannel(channel: Channel): SchemaGeneration {
  return channel === "v1" ? "v1" : "v2";
}

function classify(tables: readonly string[]): SchemaGeneration {
  const names = new Set(tables);
  const hasV2 = names.has("session_v2");
  const hasV1 = names.has("session");
  if (hasV2) return "v2";
  if (hasV1) return "v1";
  return tables.length === 0 ? "empty" : "unknown";
}

/** node:sqlite is experimental on Node 22; keep its warning out of our output. */
async function loadSqlite(): Promise<typeof import("node:sqlite") | undefined> {
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]): void => {
    const text = typeof warning === "string" ? warning : warning.message;
    const type = typeof rest[0] === "string" ? rest[0] : (rest[0] as { type?: string } | undefined)?.type;
    if (type === "ExperimentalWarning" && /SQLite/i.test(text)) return;
    (original as (...args: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return await import("node:sqlite");
  } catch {
    return undefined;
  } finally {
    process.emitWarning = original;
  }
}

/**
 * Fallback for runtimes without node:sqlite: SQLite stores CREATE TABLE
 * statements as plain text in its schema pages, so a bounded byte scan is
 * enough to tell the two generations apart.
 */
async function scanSchema(file: string): Promise<{ tables: string[]; generation: SchemaGeneration }> {
  const buffer = await readFile(file);
  const text = buffer.subarray(0, Math.min(buffer.length, 4_194_304)).toString("latin1");
  const tables = new Set<string>();
  for (const match of text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?["'`[]?([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (match[1]) tables.add(match[1]);
  }
  if (/\bsession_v2\b/.test(text)) tables.add("session_v2");
  const names = [...tables];
  return { tables: names, generation: classify(names) };
}

export async function inspectDatabase(file: string): Promise<DatabaseInfo> {
  const base: DatabaseInfo = { file, exists: false, sizeBytes: 0, generation: "empty", tables: [], method: "none" };
  if (file === ":memory:") return { ...base, method: "none" };
  let size = 0;
  try {
    const info = await stat(file);
    if (!info.isFile()) return { ...base, error: "Not a regular file" };
    size = info.size;
  } catch {
    return base;
  }
  if (size === 0) return { ...base, exists: true, sizeBytes: 0, generation: "empty" };

  const sqlite = await loadSqlite();
  if (sqlite) {
    let handle: import("node:sqlite").DatabaseSync | undefined;
    try {
      handle = new sqlite.DatabaseSync(file, { readOnly: true });
      const rows = handle
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];
      const tables = rows.map((row) => row.name).sort();
      return { file, exists: true, sizeBytes: size, generation: classify(tables), tables, method: "sqlite" };
    } catch (error) {
      // Locked, WAL-only, or corrupt: fall through to the byte scan.
      const message = error instanceof Error ? error.message : String(error);
      try {
        const scanned = await scanSchema(file);
        return { file, exists: true, sizeBytes: size, ...scanned, method: "scan", error: message };
      } catch {
        return { file, exists: true, sizeBytes: size, generation: "unknown", tables: [], method: "none", error: message };
      }
    } finally {
      try {
        handle?.close();
      } catch {
        // Closing a read-only handle must never mask the inspection result.
      }
    }
  }
  try {
    const scanned = await scanSchema(file);
    return { file, exists: true, sizeBytes: size, ...scanned, method: "scan" };
  } catch (error) {
    return {
      file, exists: true, sizeBytes: size, generation: "unknown", tables: [], method: "none",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function describeGeneration(generation: SchemaGeneration): string {
  switch (generation) {
    case "v1": return "OpenCode v1 schema (session)";
    case "v2": return "OpenCode v2 schema (session_v2)";
    case "empty": return "empty or not created yet";
    default: return "unrecognised schema";
  }
}

/**
 * Decide which database this launch should use. `auto` keeps the shared file
 * whenever it is compatible and isolates only on a real generation mismatch.
 */
export async function resolveDatabase(ctx: AppContext, config: NullxConfig, channel: Channel): Promise<DatabaseDecision> {
  const shared = await inspectDatabase(sharedDatabaseFile(ctx));
  const want = generationForChannel(channel);
  const mode = config.database;
  const channelFile = channelDatabaseFile(ctx, channel);
  const matches = shared.generation === "empty" || shared.generation === want;

  if (mode === "shared") {
    return {
      shared,
      effectiveFile: shared.file,
      isolated: false,
      compatible: matches,
      reason: matches ? "Using the shared OpenCode database." : `Shared database is ${describeGeneration(shared.generation)}, but ${channel} needs ${want}.`,
      ...(matches ? {} : { suggestion: `Run: nullx config set database auto  (gives ${channel} its own database), or nullx install --channel ${shared.generation === "v2" ? "v2" : "v1"} to match it.` }),
    };
  }

  if (mode === "channel") {
    const own = await inspectDatabase(channelFile);
    return {
      shared,
      effectiveFile: channelFile,
      isolated: true,
      compatible: own.generation === "empty" || own.generation === want,
      reason: `Using a dedicated ${channel} database.`,
    };
  }

  if (matches) {
    return { shared, effectiveFile: shared.file, isolated: false, compatible: true, reason: "Shared OpenCode database is compatible." };
  }

  const own = await inspectDatabase(channelFile);
  return {
    shared,
    effectiveFile: channelFile,
    isolated: true,
    compatible: own.generation === "empty" || own.generation === want,
    reason: `Shared database is ${describeGeneration(shared.generation)}; ${channel} cannot open it. Using a separate ${channel} database instead.`,
    suggestion: `Your sessions in ${shared.file} are untouched. To use them directly, switch channel: nullx install --channel ${shared.generation === "v2" ? "v2" : "v1"}`,
  };
}

/** Environment for a launch, with OPENCODE_DB set only when isolation is needed. */
export function databaseEnv(ctx: AppContext, decision: DatabaseDecision): NodeJS.ProcessEnv {
  if (!decision.isolated) return ctx.env;
  return { ...ctx.env, OPENCODE_DB: decision.effectiveFile };
}