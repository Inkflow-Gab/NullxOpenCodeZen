import { readFile } from "node:fs/promises";
import { blend, colorMode } from "./connection-animation.js";
import type { AppContext } from "../core/types.js";

export async function loadAscii(size: "compact" | "large"): Promise<string> {
  const file = size === "large" ? "../../assets/mascot-large.txt" : "../../assets/mascot.txt";
  return (await readFile(new URL(file, import.meta.url), "utf8").catch(() => "")).trimEnd();
}

export function renderAscii(ctx: AppContext, ascii: string): string {
  const tty = (ctx.stdout as { isTTY?: boolean }).isTTY === true;
  const mode = colorMode(ctx.env, tty);
  const plain = ascii.replace(/\x1b\[[0-9;]*m/g, "");
  if (mode === "none") return plain;
  return plain
    .split("\n")
    .map((line, index) => blend(line, mode, index * 2))
    .join("\n");
}
