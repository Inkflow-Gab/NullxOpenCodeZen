/** Terminal color and animation primitives, shared by every renderer. */

const RESET = "\x1b[0m";

const VIOLET = [139, 92, 246] as const;
const CYAN = [34, 211, 238] as const;
const FALLBACK_COLORS = [141, 140, 139, 110, 81, 80, 51, 45];

export type ColorMode = "truecolor" | "256" | "none";

export function colorMode(env: NodeJS.ProcessEnv, tty: boolean): ColorMode {
  if (!tty || env.NO_COLOR !== undefined || env.TERM === "dumb" || env.FORCE_COLOR === "0") return "none";
  const colorTerm = (env.COLORTERM ?? "").toLowerCase();
  if (colorTerm === "truecolor" || colorTerm === "24bit") return "truecolor";
  if ((env.TERM ?? "").includes("256color") || env.COLORTERM !== undefined || env.FORCE_COLOR !== undefined) return "256";
  return "none";
}

export function blend(text: string, mode: ColorMode, shift = 0): string {
  if (mode === "none" || text.length === 0) return text;
  const characters = [...text];
  return characters
    .map((character, index) => {
      const wave = (Math.sin((index / Math.max(1, characters.length)) * Math.PI * 2 + shift * 0.35) + 1) / 2;
      if (mode === "truecolor") {
        const red = Math.round(VIOLET[0] + (CYAN[0] - VIOLET[0]) * wave);
        const green = Math.round(VIOLET[1] + (CYAN[1] - VIOLET[1]) * wave);
        const blue = Math.round(VIOLET[2] + (CYAN[2] - VIOLET[2]) * wave);
        return `\x1b[38;2;${red};${green};${blue}m${character}`;
      }
      const color = FALLBACK_COLORS[(index + shift) % FALLBACK_COLORS.length] ?? 45;
      return `\x1b[38;5;${color}m${character}`;
    })
    .join("") + RESET;
}

export function animationEnabled(env: NodeJS.ProcessEnv, tty: boolean, plain?: boolean): boolean {
  return tty && plain !== true && env.NULLX_NO_ANIMATION !== "1" && env.CI === undefined && env.TERM !== "dumb";
}
