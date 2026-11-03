import type { AppContext } from "../core/types.js";

export function colorEnabled(ctx: AppContext): boolean {
  return Boolean(process.stdout.isTTY) && !ctx.env.NO_COLOR && ctx.env.TERM !== "dumb";
}

export function paint(ctx: AppContext, text: string, code: number): string {
  return colorEnabled(ctx) ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export function writeLine(ctx: AppContext, text = ""): void {
  ctx.stdout.write(`${text}\n`);
}

export function writeJson(ctx: AppContext, value: unknown): void {
  writeLine(ctx, JSON.stringify(value, null, 2));
}

export function meter(used: number, limit: number | null, width = 20): string {
  if (limit === null) return "unlimited";
  if (limit === 0) return "[####################] blocked";
  const filled = Math.min(width, Math.floor((used / limit) * width));
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}]`;
}
