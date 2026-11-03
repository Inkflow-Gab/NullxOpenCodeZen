import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { budgetSnapshot } from "../core/budget.js";
import { loadConfig } from "../core/config.js";
import { detectOpenCode } from "../core/detect.js";
import { EXIT, errorMessage } from "../core/errors.js";
import type { AppContext } from "../core/types.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { writeJson, writeLine } from "../ui/terminal.js";

interface Check { name: string; status: "ok" | "warn" | "fail"; detail: string }

export async function doctorCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const parsed = parseFlags(args, [{ names: ["--json"], takesValue: false }]);
  rejectPositionals(parsed);
  const checks: Check[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "node", status: nodeMajor >= 22 ? "ok" : "fail", detail: process.versions.node });
  try {
    const config = await loadConfig(ctx);
    checks.push({ name: "config", status: "ok", detail: ctx.paths.configFile });
    try {
      const binary = await detectOpenCode(ctx, config);
      checks.push(binary
        ? { name: "opencode", status: "ok", detail: `${binary.version} (${binary.source}) at ${binary.file}` }
        : { name: "opencode", status: "fail", detail: "Not found. Run nullx install." });
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
  if (json || parsed.flags.has("--json")) writeJson(ctx, { ok: !failed, checks });
  else {
    for (const check of checks) writeLine(ctx, `${check.status.toUpperCase().padEnd(4)} ${check.name}: ${check.detail}`);
    writeLine(ctx, failed ? "Doctor found a blocking issue." : "Doctor found no blocking issues.");
  }
  return failed ? EXIT.NOT_FOUND : 0;
}
