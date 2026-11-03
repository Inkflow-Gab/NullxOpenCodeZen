import { usage } from "../core/errors.js";

export interface ParsedFlags {
  values: Map<string, string>;
  flags: Set<string>;
  positional: string[];
  forwarded: string[];
}

interface FlagSpec {
  names: readonly string[];
  takesValue: boolean;
}

export function parseFlags(args: readonly string[], specs: readonly FlagSpec[]): ParsedFlags {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positional: string[] = [];
  const forwarded: string[] = [];
  const lookup = new Map<string, FlagSpec>();
  for (const spec of specs) for (const name of spec.names) lookup.set(name, spec);
  let passthrough = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (passthrough) { forwarded.push(arg); continue; }
    if (arg === "--") { passthrough = true; continue; }
    if (!arg.startsWith("-") || arg === "-") { positional.push(arg); continue; }
    const equals = arg.indexOf("=");
    const name = equals === -1 ? arg : arg.slice(0, equals);
    const spec = lookup.get(name);
    if (!spec) throw usage(`Unknown option ${name}. Use -- before options intended for OpenCode.`);
    const canonical = spec.names[0]!;
    if (spec.takesValue) {
      const value = equals === -1 ? args[++index] : arg.slice(equals + 1);
      if (value === undefined || value === "" || value.startsWith("--")) throw usage(`${name} requires a value`);
      values.set(canonical, value);
    } else {
      if (equals !== -1) throw usage(`${name} does not take a value`);
      flags.add(canonical);
    }
  }
  return { values, flags, positional, forwarded };
}

export function rejectPositionals(parsed: ParsedFlags, max = 0): void {
  if (parsed.positional.length > max) throw usage(`Unexpected argument: ${parsed.positional[max]}`);
}

export function hasModelFlag(args: readonly string[]): boolean {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") return false;
    if (arg === "--model" || arg === "-m" || arg.startsWith("--model=") || arg.startsWith("-m=")) return true;
  }
  return false;
}

export function modelFromArgs(args: readonly string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") return undefined;
    if (arg.startsWith("--model=")) return arg.slice("--model=".length);
    if (arg.startsWith("-m=")) return arg.slice("-m=".length);
    if (arg === "--model" || arg === "-m") return args[index + 1];
  }
  return undefined;
}

export function isHelpOrVersion(args: readonly string[]): boolean {
  const end = args.indexOf("--");
  const visible = end === -1 ? args : args.slice(0, end);
  return visible.some((arg) => ["--help", "-h", "--version", "-V"].includes(arg));
}
