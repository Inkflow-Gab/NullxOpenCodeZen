import { usage } from "../core/errors.js";
import type { AppContext } from "../core/types.js";
import { paint, writeLine } from "../ui/terminal.js";
import { VERSION } from "../version.js";

export const COMMAND_HELP = [
  ["start", "Open the OpenCode TUI with a local session budget", "nullx start [opencode options]"],
  ["run", "Run one OpenCode prompt with a local run budget", "nullx run [opencode run options] \"prompt\""],
  ["install", "Detect or install a pinned official OpenCode CLI", "nullx install [--channel v1|v2] [--version x.y.z] [--force] [--dry-run]"],
  ["doctor", "Check Node, OpenCode, config, storage, and budgets", "nullx doctor [--json]"],
  ["status", "Show the local dashboard", "nullx status [--json]"],
  ["budget", "Show or change local daily launch limits", "nullx budget [status|set|reset]"],
  ["model", "Select the default model for wrapped launches", "nullx model [show|set <provider/model>|clear]"],
  ["models", "List models through OpenCode", "nullx models [opencode options]"],
  ["auth", "Open OpenCode's own authentication flow", "nullx auth [login|list|logout ...]"],
  ["stats", "Show OpenCode's own token/cost statistics", "nullx stats [opencode options]"],
  ["history", "Show the private local launch journal", "nullx history [--limit 20] [--json]"],
  ["config", "Manage wrapper configuration", "nullx config [init|show|path|set|unset]"],
  ["paths", "Print wrapper storage paths", "nullx paths [--json]"],
  ["about", "Show project information and the mascot", "nullx about"],
  ["help", "Show help for a command", "nullx help [command]"],
] as const;

export function showHelp(ctx: AppContext, topic?: string): void {
  if (topic) {
    const command = COMMAND_HELP.find(([name]) => name === topic);
    if (!command) throw usage(`Unknown command: ${topic}`);
    writeLine(ctx, `${paint(ctx, command[0], 36)} — ${command[1]}`);
    writeLine(ctx, `Usage: ${command[2]}`);
    if (topic === "run" || topic === "start") {
      writeLine(ctx, "Everything after the command is forwarded to OpenCode. Use -- to protect forwarded options.");
      writeLine(ctx, "The wrapper records launch metadata only, never prompt text or credentials.");
    }
    if (topic === "budget") {
      writeLine(ctx, "Examples: nullx budget set --runs 40 --sessions 12 --timezone Asia/Manila");
      writeLine(ctx, "          nullx budget set --runs unlimited");
      writeLine(ctx, "          nullx budget reset --yes");
    }
    if (topic === "config") {
      writeLine(ctx, "Keys: channel, binary, model, timezone, history-limit, auto-install");
      writeLine(ctx, "Example: nullx config set binary /usr/local/bin/opencode");
    }
    return;
  }
  writeLine(ctx, paint(ctx, `Nullx OpenCode Zen ${VERSION}`, 35));
  writeLine(ctx, "A local-first companion for the official OpenCode CLI.");
  writeLine(ctx);
  writeLine(ctx, "Usage: nullx <command> [options]");
  writeLine(ctx);
  for (const [name, description] of COMMAND_HELP) {
    writeLine(ctx, `  ${paint(ctx, name.padEnd(10), 36)} ${description}`);
  }
  writeLine(ctx);
  writeLine(ctx, "Global options: --help, --version, --json (before local commands), --home <path>, --no-color");
  writeLine(ctx, "Quick start: nullx install && nullx auth && nullx model set <provider/model> && nullx start");
  writeLine(ctx, "Local launch budgets are not OpenCode Zen account quotas or token balances.");
}
