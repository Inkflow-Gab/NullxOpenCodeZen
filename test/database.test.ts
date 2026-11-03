import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  channelDatabaseFile,
  databaseEnv,
  describeGeneration,
  inspectDatabase,
  openCodeDataDir,
  resolveDatabase,
  sharedDatabaseFile,
} from "../src/core/database.js";
import { defaultConfig } from "../src/core/config.js";
import { context } from "./helpers.js";

/** Build a real SQLite file with the requested tables. */
async function database(file: string, tables: readonly string[]): Promise<string> {
  await mkdir(path.dirname(file), { recursive: true });
  const { DatabaseSync } = await import("node:sqlite");
  const handle = new DatabaseSync(file);
  for (const table of tables) handle.exec(`CREATE TABLE IF NOT EXISTS "${table}" (id TEXT)`);
  handle.close();
  return file;
}

test("data dir follows XDG_DATA_HOME and honours OPENCODE_DB", async () => {
  const ctx = await context();
  assert.equal(openCodeDataDir(ctx), path.join(ctx.homeDir, ".local", "share", "opencode"));
  ctx.env.XDG_DATA_HOME = path.join(ctx.root, "xdg");
  assert.equal(openCodeDataDir(ctx), path.join(ctx.root, "xdg", "opencode"));
  assert.equal(sharedDatabaseFile(ctx), path.join(ctx.root, "xdg", "opencode", "opencode.db"));
  ctx.env.OPENCODE_DB = "custom.db";
  assert.equal(sharedDatabaseFile(ctx), path.join(ctx.root, "xdg", "opencode", "custom.db"));
});

test("schema inspection distinguishes v1, v2, empty, and missing databases", async () => {
  const ctx = await context();
  const dir = path.join(ctx.root, "dbs");
  const v1 = await database(path.join(dir, "v1.db"), ["session", "message", "migration"]);
  const v2 = await database(path.join(dir, "v2.db"), ["session_v2", "migration", "project"]);
  const other = await database(path.join(dir, "other.db"), ["whatever"]);

  const one = await inspectDatabase(v1);
  assert.equal(one.generation, "v1");
  assert.equal(one.exists, true);
  assert.ok(one.tables.includes("session"));

  const two = await inspectDatabase(v2);
  assert.equal(two.generation, "v2");
  assert.ok(two.tables.includes("session_v2"));

  assert.equal((await inspectDatabase(other)).generation, "unknown");
  const missing = await inspectDatabase(path.join(dir, "absent.db"));
  assert.equal(missing.exists, false);
  assert.equal(missing.generation, "empty");
  assert.match(describeGeneration(two.generation), /session_v2/);
});

test("auto mode isolates a v1 launch when the shared database is v2", async () => {
  const ctx = await context();
  await database(sharedDatabaseFile(ctx), ["session_v2", "migration"]);
  const decision = await resolveDatabase(ctx, defaultConfig(), "v1");
  assert.equal(decision.isolated, true);
  assert.equal(decision.compatible, true);
  assert.equal(decision.effectiveFile, channelDatabaseFile(ctx, "v1"));
  assert.match(decision.reason, /v2 schema/);
  assert.match(decision.suggestion ?? "", /--channel v2/);
  // The env override is what actually prevents the crash.
  assert.equal(databaseEnv(ctx, decision).OPENCODE_DB, decision.effectiveFile);
});

test("auto mode isolates a v2 launch when the shared database is v1", async () => {
  const ctx = await context();
  await database(sharedDatabaseFile(ctx), ["session", "migration"]);
  const decision = await resolveDatabase(ctx, defaultConfig(), "v2");
  assert.equal(decision.isolated, true);
  assert.equal(decision.effectiveFile, channelDatabaseFile(ctx, "v2"));
});

test("a compatible or absent shared database is used directly with no override", async () => {
  const ctx = await context();
  const fresh = await resolveDatabase(ctx, defaultConfig(), "v1");
  assert.equal(fresh.isolated, false);
  assert.equal(databaseEnv(ctx, fresh).OPENCODE_DB, undefined);

  await database(sharedDatabaseFile(ctx), ["session", "migration"]);
  const matching = await resolveDatabase(ctx, defaultConfig(), "v1");
  assert.equal(matching.isolated, false);
  assert.equal(matching.compatible, true);
  assert.equal(matching.effectiveFile, sharedDatabaseFile(ctx));
});

test("shared mode refuses to guess and reports an actionable fix", async () => {
  const ctx = await context();
  await database(sharedDatabaseFile(ctx), ["session_v2"]);
  const config = { ...defaultConfig(), database: "channel" as const };
  const isolated = await resolveDatabase(ctx, config, "v1");
  assert.equal(isolated.isolated, true);

  const shared = { ...defaultConfig(), database: "shared" as const };
  const forced = await resolveDatabase(ctx, shared, "v1");
  assert.equal(forced.isolated, false);
  assert.equal(forced.compatible, false);
  assert.match(forced.suggestion ?? "", /config set database auto/);
});

test("inspection never writes to the shared database", async () => {
  const ctx = await context();
  const file = await database(sharedDatabaseFile(ctx), ["session_v2", "migration"]);
  const before = await (await import("node:fs/promises")).readFile(file);
  await inspectDatabase(file);
  await resolveDatabase(ctx, defaultConfig(), "v1");
  const after = await (await import("node:fs/promises")).readFile(file);
  assert.deepEqual(after, before, "the user's sessions must not be modified");
});

test("a non-database file degrades to unknown instead of throwing", async () => {
  const ctx = await context();
  const file = path.join(ctx.root, "junk.db");
  await writeFile(file, "this is not sqlite");
  const info = await inspectDatabase(file);
  assert.equal(info.exists, true);
  assert.ok(["unknown", "empty"].includes(info.generation));
});
