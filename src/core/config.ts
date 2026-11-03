import { AppError, EXIT } from "./errors.js";
import { readJsonFile, writeJsonAtomic } from "./json.js";
import { ensurePrivateDirectory } from "./paths.js";
import type { AppContext, NullxConfig } from "./types.js";
import {
  assertOnlyKeys,
  binaryPathValue,
  booleanValue,
  channelValue,
  databaseModeValue,
  integerValue,
  isRecord,
  modelValue,
  timezoneValue,
} from "./validation.js";

export function defaultConfig(): NullxConfig {
  return {
    version: 1,
    channel: "v1",
    binaryPath: null,
    defaultModel: null,
    autoInstall: true,
    database: "auto",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    historyLimit: 1_000,
    budget: { runsPerDay: 30, sessionsPerDay: 10, warnAtPercent: 80 },
  };
}

export function validateConfig(value: unknown, platform: NodeJS.Platform, cwd: string): NullxConfig {
  if (!isRecord(value)) throw new AppError("CONFIG_INVALID", "Config must be a JSON object", EXIT.CONFIG);
  assertOnlyKeys(value, ["version", "channel", "binaryPath", "defaultModel", "autoInstall", "database", "timezone", "historyLimit", "budget"], "config");
  if (value.version !== 1) throw new AppError("CONFIG_VERSION", "Only config version 1 is supported", EXIT.CONFIG);
  if (!isRecord(value.budget)) throw new AppError("CONFIG_INVALID", "budget must be an object", EXIT.CONFIG);
  assertOnlyKeys(value.budget, ["runsPerDay", "sessionsPerDay", "warnAtPercent"], "budget");
  const limit = (input: unknown, label: string): number | null => input === null ? null : integerValue(input, label, 0, 1_000_000);
  if (!(value.binaryPath === null || typeof value.binaryPath === "string")) {
    throw new AppError("CONFIG_INVALID", "binaryPath must be a string or null", EXIT.CONFIG);
  }
  if (!(value.defaultModel === null || typeof value.defaultModel === "string")) {
    throw new AppError("CONFIG_INVALID", "defaultModel must be a string or null", EXIT.CONFIG);
  }
  const binary = value.binaryPath === null ? null : binaryPathValue(value.binaryPath, cwd, platform);
  const model = value.defaultModel === null ? null : modelValue(value.defaultModel);
  return {
    version: 1,
    channel: channelValue(value.channel),
    binaryPath: binary,
    defaultModel: model,
    autoInstall: booleanValue(value.autoInstall, "autoInstall"),
    // Older configs predate this key; default to the safe behaviour.
    database: value.database === undefined ? "auto" : databaseModeValue(value.database),
    timezone: timezoneValue(value.timezone),
    historyLimit: integerValue(value.historyLimit, "historyLimit", 10, 100_000),
    budget: {
      runsPerDay: limit(value.budget.runsPerDay, "budget.runsPerDay"),
      sessionsPerDay: limit(value.budget.sessionsPerDay, "budget.sessionsPerDay"),
      warnAtPercent: integerValue(value.budget.warnAtPercent, "budget.warnAtPercent", 1, 100),
    },
  };
}

export async function loadConfig(ctx: AppContext): Promise<NullxConfig> {
  const raw = await readJsonFile(ctx.paths.configFile);
  if (raw === undefined) return defaultConfig();
  return validateConfig(raw, ctx.platform, ctx.cwd);
}

export async function saveConfig(ctx: AppContext, config: NullxConfig): Promise<void> {
  const validated = validateConfig(config, ctx.platform, ctx.cwd);
  await ensurePrivateDirectory(ctx.paths.configDir);
  await writeJsonAtomic(ctx.paths.configFile, validated);
}

export async function initConfig(ctx: AppContext, force: boolean): Promise<{ created: boolean; config: NullxConfig }> {
  const existing = await readJsonFile(ctx.paths.configFile);
  if (existing !== undefined && !force) {
    throw new AppError("CONFIG_EXISTS", `Config already exists at ${ctx.paths.configFile}. Use --force to replace it.`, EXIT.CONFIG);
  }
  const config = defaultConfig();
  await saveConfig(ctx, config);
  return { created: existing === undefined, config };
}
