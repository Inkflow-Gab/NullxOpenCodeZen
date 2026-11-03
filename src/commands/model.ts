import { loadConfig, saveConfig } from "../core/config.js";
import { usage } from "../core/errors.js";
import type { AppContext } from "../core/types.js";
import { modelValue } from "../core/validation.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { writeJson, writeLine } from "../ui/terminal.js";

export async function modelCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const subcommand = args[0] ?? "show";
  const rest = args.slice(1);
  const config = await loadConfig(ctx);
  if (subcommand === "show") {
    if (json) writeJson(ctx, { model: config.defaultModel });
    else writeLine(ctx, config.defaultModel ?? "No wrapper default model; OpenCode chooses.");
    return 0;
  }
  if (subcommand === "set") {
    const parsed = parseFlags(rest, []);
    rejectPositionals(parsed, 1);
    if (parsed.positional.length !== 1) throw usage("Usage: nullx model set <provider/model>");
    config.defaultModel = modelValue(parsed.positional[0]!);
    await saveConfig(ctx, config);
    if (json) writeJson(ctx, { model: config.defaultModel });
    else writeLine(ctx, `Default model set to ${config.defaultModel}. Authenticate it with nullx auth login.`);
    return 0;
  }
  if (subcommand === "clear") {
    config.defaultModel = null;
    await saveConfig(ctx, config);
    if (json) writeJson(ctx, { model: null });
    else writeLine(ctx, "Wrapper default model cleared.");
    return 0;
  }
  throw usage(`Unknown model command: ${subcommand}`);
}
