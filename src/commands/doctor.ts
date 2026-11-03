import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { budgetSnapshot } from "../core/budget.js";
import { loadConfig } from "../core/config.js";
import { inspectOpenCode } from "../core/detect.js";
import { describeEnvironment, environmentLabel } from "../core/environment.js";
import { findCommandConflict } from "../core/launcher.js";
import { EXIT, errorMessage } from "../core/errors.js";
import type { AppContext } from "../core/types.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { gradient, paint, writeJson, writeLine } from "../ui/terminal.js";

interface Check { name: string; status: "ok" | "warn" | "fail"; detail: string }

export async function doctorCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const parsed = parseFlags(args, [
    { names: ["--json"], takesValue: false },
    { names: ["--verbose"], takesValue: false },
  ]);
  rejectPositionals(parsed);
  const checks: Check[] = [];
  let detection: Awaited<ReturnType<typeof inspectOpenCode>> | undefined;
  const environment = await describeEnvironment({ env: ctx.env, platform: ctx.platform });
  checks.push({ name: "environment", status: "ok", detail: environmentLabel(environment) });
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "node", status: nodeMajor >= 22 ? "ok" : "fail", detail: process.versions.node });
  try {
    const conflict = await findCommandConflict(ctx);
    if (!conflict) {
      checks.push({ name: "command", status: "warn", detail: "No `nullx` on PATH. Run nullx setup, or open a new shell." });
    } else if (conflict.owner === "foreign") {
      checks.push({ name: "command", status: "warn", detail: `${conflict.file} is another program. ${conflict.detail}. Run nullx setup to install nullx-zen alongside it.` });
    } else {
      checks.push({ name: "command", status: "ok", detail: conflict.file });
    }
  } catch (error) {
    checks.push({ name: "command", status: "warn", detail: errorMessage(error) });
  }
  try {
    const config = await loadConfig(ctx);
    checks.push({ name: "config", status: "ok", detail: ctx.paths.configFile });
    try {
      detection = await inspectOpenCode(ctx, config);
      const binary = detection.selected;
      checks.push(binary
        ? { name: "opencode", status: "ok", detail: `${binary.version} (${binary.source}) at ${binary.file}` }
        : { name: "opencode", status: "fail", detail: "Not found. Run nullx install." });
      for (const warning of detection.warnings) checks.push({ name: "opencode:warning", status: "warn", detail: warning });
    } catch (error) {
      checks.push({ name: "opencode", status: "fail", detail: errorMessage(error) });
    }
    try {
      const snapshot = await budgetSnapshot(ctx, config);
      checks.push({ name: "budget", status: "ok", detail: `${snapshot.runs} runs, ${snapshot.sessions} sessions on ${snapshot.day}; resets ${snapshot.resetsAt}` });
    } catch (error) {
      checks.push({ name: "budget", status: "fail", detail: errorMessage(error) });
    }
  } catch (error) {
    checks.push({ name: "config", status: "fail", detail: errorMessage(error) });
  }
  for (const directory of [path.dirname(ctx.paths.configDir), path.dirname(ctx.paths.stateDir), path.dirname(ctx.paths.dataDir)]) {
    try {
      await access(directory, constants.W_OK);
      checks.push({ name: `storage:${directory}`, status: "ok", detail: "Parent directory is writable" });
    } catch {
      checks.push({ name: `storage:${directory}`, status: "warn", detail: "Parent is not writable or does not exist yet" });
    }
  }
  const failed = checks.some((check) => check.status === "fail");
  if (json || parsed.flags.has("--json")) {
    writeJson(ctx, { ok: !failed, environment, checks, ...(detection ? { detection } : {}) });
  } else {
    writeLine(ctx, gradient(ctx, "Nullx OpenCode Zen · doctor"));
    for (const check of checks) {
      const color = check.status === "ok" ? 32 : check.status === "warn" ? 33 : 31;
      writeLine(ctx, `${paint(ctx, check.status.toUpperCase().padEnd(4), color)} ${check.name}: ${check.detail}`);
    }
    if (parsed.flags.has("--verbose") && detection) {
      writeLine(ctx);
      writeLine(ctx, "OpenCode candidates:");
      for (const candidate of detection.candidates) {
        const version = candidate.version ? `${candidate.version} (${candidate.channel ?? "unknown"})` : "unprobed";
        writeLine(ctx, `  ${candidate.selected ? "*" : " "} ${candidate.source} ${version} ${candidate.file} — ${candidate.detail ?? candidate.reason}`);
      }
    }
    for (const hint of environment.hints) writeLine(ctx, `${paint(ctx, "HINT", 36)} ${hint}`);
    writeLine(ctx, failed ? "Doctor found a blocking issue." : "Doctor found no blocking issues.");
  }
  return failed ? EXIT.NOT_FOUND : 0;
}
