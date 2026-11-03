import { readFile } from "node:fs/promises";
import { colorMode } from "./color.js";
import { tint, visibleWidth } from "./live-line.js";
import type { AppContext } from "../core/types.js";

export async function loadAscii(size: "compact" | "large" | "wordmark"): Promise<string> {
  const file = size === "large" ? "../../assets/mascot-large.txt"
    : size === "wordmark" ? "../../assets/wordmark.txt"
    : "../../assets/mascot.txt";
  return (await readFile(new URL(file, import.meta.url), "utf8").catch(() => "")).trimEnd();
}

/** Width of the widest art line, used to pick a size that actually fits. */
export function asciiWidth(ascii: string): number {
  return ascii.split("\n").reduce((widest, line) => Math.max(widest, visibleWidth(line)), 0);
}

export function renderAscii(ctx: AppContext, ascii: string): string {
  const tty = (ctx.stdout as { isTTY?: boolean }).isTTY === true;
  const mode = colorMode(ctx.env, tty);
  const plain = ascii.replace(/\x1b\[[0-9;]*m/g, "");
  if (mode === "none") return plain;
  // One escape per line, not per character: far less output on slow terminals.
  return plain.split("\n").map((line, index) => tint(line, mode, index)).join("\n");
}

/** Pick the largest art that fits the terminal, degrading to the wordmark. */
export async function loadFittingAscii(columns: number): Promise<string> {
  for (const size of ["large", "compact", "wordmark"] as const) {
    const ascii = await loadAscii(size);
    if (ascii.length > 0 && asciiWidth(ascii) <= columns) return ascii;
  }
  return "";
}
