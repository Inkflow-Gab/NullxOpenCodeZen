import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig, initConfig, loadConfig, saveConfig, validateConfig } from "../src/core/config.js";
import { modelValue, parseLimit, timezoneValue, versionValue } from "../src/core/validation.js";
import { context } from "./helpers.js";

test("config defaults are strict and round-trip through disk", async () => {
  const ctx = await context();
  const config = defaultConfig();
  assert.equal(config.budget.runsPerDay, 30);
  await saveConfig(ctx, config);
  assert.deepEqual(await loadConfig(ctx), config);
});

test("config rejects unknown keys, invalid limits, and invalid timezones", () => {
  assert.throws(() => validateConfig({ ...defaultConfig(), surprise: true }, process.platform, process.cwd()), /unknown keys/);
  assert.throws(() => validateConfig({ ...defaultConfig(), budget: { runsPerDay: -1, sessionsPerDay: 1, warnAtPercent: 80 } }, process.platform, process.cwd()), /integer/);
  assert.throws(() => timezoneValue("Not/AZone"), /Unknown IANA timezone/);
  const missingBinary = { ...defaultConfig() } as Record<string, unknown>;
  delete missingBinary.binaryPath;
  assert.throws(() => validateConfig(missingBinary, process.platform, process.cwd()), /binaryPath must be a string or null/);
});

test("init refuses accidental overwrite unless forced", async () => {
  const ctx = await context();
  await initConfig(ctx, false);
  await assert.rejects(initConfig(ctx, false), /already exists/);
  await initConfig(ctx, true);
});

test("model, version, and limit validation", () => {
  assert.equal(modelValue("openrouter/vendor/model"), "openrouter/vendor/model");
  assert.throws(() => modelValue("missing-provider"), /provider\/model/);
  assert.equal(versionValue("2.2.5"), "2.2.5");
  assert.throws(() => versionValue("latest"), /exact version/);
  assert.equal(parseLimit("unlimited", "runs"), null);
  assert.equal(parseLimit("0", "runs"), 0);
  assert.throws(() => parseLimit("-1", "runs"), /non-negative/);
});
