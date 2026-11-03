import os from "node:os";
import { aboutCommand, pathsCommand } from "./commands/about.js";
import { budgetCommand } from "./commands/budget.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { showHelp } from "./commands/help.js";
import { historyCommand } from "./commands/history.js";
import { installCommand } from "./commands/install.js";
import { launchCommand } from "./commands/launch.js";
import { mascotCommand } from "./commands/mascot.js";
import { modelCommand } from "./commands/model.js";
import { setupCommand } from "./commands/setup.js";
import { statusCommand } from "./commands/status.js";
import { upstreamCommand } from "./commands/upstream.js";
import { loadConfig } from "./core/config.js";
import { AppError, EXIT, errorMessage, usage } from "./core/errors.js";
import { createPaths } from "./core/paths.js";
import { execute } from "./core/process.js";
import type { AppContext } from "./core/types.js";
import { VERSION } from "./version.js";

const JSON_COMMANDS = new Set(["setup", "install", "doctor", "status", "budget", "model", "history", "config", "paths"]);

export async function main(argv: readonly string[], overrides: Partial<AppContext> = {}): Promise<number> {
  const args = [...argv];
  let json = false;
  let help = false;
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides.env };
  const cwd = overrides.cwd ?? process.cwd();
  const platform = overrides.platform ?? process.platform;
  const homeDir = overrides.homeDir ?? os.homedir();
  const ctx: AppContext = {
    cwd,
    env,
    platform,
    homeDir,
    stdout: overrides.stdout ?? process.stdout,
    stderr: overrides.stderr ?? process.stderr,
    now: overrides.now ?? (() => new Date()),
    paths: overrides.paths ?? createPaths({ cwd, env, platform, homeDir }),
    exec: overrides.exec ?? execute,
  };

  try {
    while (args[0]?.startsWith("-")) {
      const option = args.shift()!;
      if (option === "--json") json = true;
      else if (option === "--no-color") env.NO_COLOR = "1";
      else if (option === "--no-animation") env.NULLX_NO_ANIMATION = "1";
      else if (option === "--help" || option === "-h") help = true;
      else if (option === "--version" || option === "-V") {
        ctx.stdout.write(`${VERSION}\n`);
        return 0;
      } else if (option === "--home") {
        const home = args.shift();
        if (!home) throw usage("--home requires a path");
        env.NULLX_HOME = home;
        if (!overrides.paths) ctx.paths = createPaths({ cwd, env, platform, homeDir });
      } else throw usage(`Unknown global option: ${option}`);
    }
    const command = args.shift();
    const rest = args;
    if (!command) { showHelp(ctx); return 0; }
    if (command === "help") { showHelp(ctx, rest[0]); return 0; }
    if (help) { showHelp(ctx, command); return 0; }
    if (json && !JSON_COMMANDS.has(command)) throw usage("--json is supported before local reporting commands, not OpenCode passthrough commands");
    switch (command) {
      case "setup": return await setupCommand(ctx, rest, json);
      case "install": return await installCommand(ctx, rest, json);
      case "doctor": return await doctorCommand(ctx, rest, json);
      case "status": return await statusCommand(ctx, rest, json);
      case "budget": return await budgetCommand(ctx, rest, json);
      case "config": return await configCommand(ctx, rest, json);
      case "model": return await modelCommand(ctx, rest, json);
      case "history": return await historyCommand(ctx, rest, json);
      case "paths": return pathsCommand(ctx, rest, json);
      case "about": return await aboutCommand(ctx);
      case "mascot": return await mascotCommand(ctx, rest);
      case "start": return await launchCommand(ctx, await loadConfig(ctx), "session", rest);
      case "run": return await launchCommand(ctx, await loadConfig(ctx), "run", rest);
      case "auth":
      case "models":
      case "stats": return await upstreamCommand(ctx, await loadConfig(ctx), command, rest);
      default: throw usage(`Unknown command: ${command}. Run nullx help.`);
    }
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", errorMessage(error), EXIT.FAILURE);
    if (json) ctx.stdout.write(`${JSON.stringify({ error: { code: appError.code, message: appError.message, details: appError.details ?? null } }, null, 2)}\n`);
    else {
      ctx.stderr.write(`nullx: ${appError.message}\n`);
      if (env.NULLX_DEBUG === "1" && error instanceof Error && error.stack) ctx.stderr.write(`${error.stack}\n`);
    }
    return appError.exitCode;
  }
}
