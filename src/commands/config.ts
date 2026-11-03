import { initConfig, loadConfig, saveConfig } from "../core/config.js";
import { resolveExplicitBinary } from "../core/detect.js";
import { usage } from "../core/errors.js";
import type { AppContext } from "../core/types.js";
import { binaryPathValue, channelValue, integerValue, modelValue, parseBoolean, timezoneValue } from "../core/validation.js";
import { parseFlags, rejectPositionals } from "../utils/args.js";
import { writeJson, writeLine } from "../ui/terminal.js";

export async function configCommand(ctx: AppContext, args: readonly string[], json: boolean): Promise<number> {
  const subcommand = args[0] ?? "show";
  const rest = args.slice(1);
  if (subcommand === "init") {
    const parsed = parseFlags(rest, [{ names: ["--force"], takesValue: false }]);
    rejectPositionals(parsed);
    const result = await initConfig(ctx, parsed.flags.has("--force"));
    if (json) writeJson(ctx, result);
    else writeLine(ctx, `${result.created ? "Created" : "Replaced"} ${ctx.paths.configFile}`);
    return 0;
  }
  if (subcommand === "show") {
    const parsed = parseFlags(rest, [{ names: ["--json"], takesValue: false }]);
    rejectPositionals(parsed);
    writeJson(ctx, await loadConfig(ctx));
    return 0;
  }
  if (subcommand === "path") {
    writeLine(ctx, ctx.paths.configFile);
    return 0;
  }
  if (subcommand === "set") {
    const parsed = parseFlags(rest, []);
    if (parsed.positional.length !== 2) throw usage("Usage: nullx config set <key> <value>");
    const [key, value] = parsed.positional as [string, string];
    const config = await loadConfig(ctx);
    switch (key) {
      case "channel": config.channel = channelValue(value); break;
      case "binary": config.binaryPath = (await resolveExplicitBinary(binaryPathValue(value, ctx.cwd, ctx.platform), "config", ctx.platform)).file; break;
      case "model": config.defaultModel = modelValue(value); break;
      case "timezone": config.timezone = timezoneValue(value); break;
      case "history-limit": config.historyLimit = integerValue(Number(value), "history-limit", 10, 100_000); break;
      case "auto-install": config.autoInstall = parseBoolean(value, "auto-install"); break;
      default: throw usage(`Unknown config key: ${key}`);
    }
    await saveConfig(ctx, config);
    if (json) writeJson(ctx, config);
    else writeLine(ctx, `Set ${key}.`);
    return 0;
  }
  if (subcommand === "unset") {
    const parsed = parseFlags(rest, []);
    if (parsed.positional.length !== 1) throw usage("Usage: nullx config unset <binary|model>");
    const key = parsed.positional[0]!;
    if (key !== "binary" && key !== "model") throw usage("Only binary and model can be unset");
    const config = await loadConfig(ctx);
    if (key === "binary") config.binaryPath = null;
    else config.defaultModel = null;
    await saveConfig(ctx, config);
    if (json) writeJson(ctx, config);
    else writeLine(ctx, `Unset ${key}.`);
    return 0;
  }
  throw usage(`Unknown config command: ${subcommand}`);
}
