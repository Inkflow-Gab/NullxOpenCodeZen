import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AppContext } from "../core/types.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { writeJson, writeLine } from "../ui/terminal.js";
import { PROJECT_NAME, UPSTREAM_REPOSITORY, VERSION } from "../version.js";

export async function aboutCommand(ctx: AppContext): Promise<number> {
  const ascii = await readFile(new URL("../../assets/mascot.txt", import.meta.url), "utf8").catch(() => "");
  const sprite = fileURLToPath(new URL("../../assets/nullx-scythe.png", import.meta.url));
  writeLine(ctx, ascii.trimEnd());
  writeLine(ctx, `${PROJECT_NAME} ${VERSION}`);
  writeLine(ctx, "An educational, local-first companion for the official OpenCode CLI.");
  writeLine(ctx, "Managed installs, explicit model selection, daily launch budgets, and private launch metadata.");
  writeLine(ctx, `Upstream: ${UPSTREAM_REPOSITORY}`);
  writeLine(ctx, `Mascot: ${sprite}`);
  writeLine(ctx, "Not affiliated with or endorsed by the OpenCode team.");
  return 0;
}

export function pathsCommand(ctx: AppContext, args: readonly string[], json: boolean): number {
  const parsed = parseFlags(args, [{ names: ["--json"], takesValue: false }]);
  rejectPositionals(parsed);
  if (json || parsed.flags.has("--json")) writeJson(ctx, ctx.paths);
  else for (const [name, value] of Object.entries(ctx.paths)) writeLine(ctx, `${name.padEnd(14)} ${value}`);
  return 0;
}
