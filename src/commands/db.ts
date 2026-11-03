import { loadConfig } from "../core/config.js";
import { describeGeneration, inspectDatabase, resolveDatabase, sharedDatabaseFile } from "../core/database.js";
import { inspectOpenCode } from "../core/detect.js";
import type { AppContext, Channel } from "../core/types.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { gradient, paint, writeJson, writeLine } from "../ui/terminal.js";

function channelOf(version: string, fallback: Channel): Channel {
  const major = Number(version.split(".")[0]);
  return major >= 2 ? "v2" : major === 1 ? "v1" : fallback;
}

/**
 * Explain the OpenCode v1/v2 database split, which otherwise surfaces as the
 * cryptic "Database is not empty and has no session table" crash.
 */
export async function dbCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const parsed = parseFlags(args, [{ names: ["--json"], takesValue: false }]);
  rejectPositionals(parsed);
  const useJson = json || parsed.flags.has("--json");
  const config = await loadConfig(ctx);
  const detection = await inspectOpenCode(ctx, config).catch(() => undefined);
  const channel = detection?.selected ? channelOf(detection.selected.version, config.channel) : config.channel;
  const decision = await resolveDatabase(ctx, config, channel);
  const shared = decision.shared;
  const wal = await inspectDatabase(`${shared.file}-wal`).catch(() => undefined);

  if (useJson) {
    writeJson(ctx, {
      ok: decision.compatible,
      channel,
      mode: config.database,
      sharedDatabase: shared,
      effectiveDatabase: decision.effectiveFile,
      isolated: decision.isolated,
      reason: decision.reason,
      ...(decision.suggestion ? { suggestion: decision.suggestion } : {}),
    });
    return decision.compatible ? 0 : 3;
  }

  writeLine(ctx, gradient(ctx, "Nullx OpenCode Zen · database"));
  writeLine(ctx, `OpenCode channel : ${channel}${detection?.selected ? ` (${detection.selected.version})` : ""}`);
  writeLine(ctx, `Isolation mode   : ${config.database}`);
  writeLine(ctx, `Shared database  : ${shared.file}`);
  writeLine(ctx, `  exists         : ${shared.exists ? "yes" : "no"}`);
  if (shared.exists) {
    writeLine(ctx, `  size           : ${(shared.sizeBytes / 1024).toFixed(0)} KiB`);
    writeLine(ctx, `  schema         : ${describeGeneration(shared.generation)}`);
    writeLine(ctx, `  session tables : ${shared.tables.filter((t) => t.startsWith("session")).join(", ") || "none"}`);
    if (wal?.exists) writeLine(ctx, `  write-ahead log: present (${(wal.sizeBytes / 1024).toFixed(0)} KiB)`);
    if (shared.error) writeLine(ctx, `  ${paint(ctx, "note", 33)}: read via ${shared.method} (${shared.error})`);
  }
  writeLine(ctx, `Database in use  : ${decision.effectiveFile}`);
  writeLine(ctx);
  writeLine(ctx, decision.compatible
    ? `${paint(ctx, "OK", 32)}   ${decision.reason}`
    : `${paint(ctx, "FAIL", 31)} ${decision.reason}`);
  if (decision.suggestion) writeLine(ctx, `     ${decision.suggestion}`);
  if (decision.isolated) {
    writeLine(ctx);
    writeLine(ctx, "Isolated mode keeps your existing OpenCode sessions untouched. Nullx sets");
    writeLine(ctx, `OPENCODE_DB=${decision.effectiveFile} for its own launches only.`);
  }
  writeLine(ctx);
  writeLine(ctx, "Modes: nullx config set database auto|shared|channel");
  return decision.compatible ? 0 : 3;
}

export { sharedDatabaseFile };
