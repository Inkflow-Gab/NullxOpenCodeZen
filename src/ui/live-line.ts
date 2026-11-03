import type { Writable } from "node:stream";
import { animationEnabled, blend, colorMode } from "./color.js";

export type TtyStream = Writable & { isTTY?: boolean; columns?: number };

const RESET = "\x1b[0m";
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
const CLEAR_LINE = "\x1b[2K\r";

export function visibleWidth(text: string): number {
  // Strip ANSI, then count code points. Wide glyphs are approximated as 1;
  // we only render ASCII plus a few symbols we control.
  return [...text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")].length;
}

/**
 * Truncate by *visible* width, never by byte or code-unit count. Slicing a
 * colored string directly cuts escape sequences in half and leaks garbage.
 */
export function truncateVisible(text: string, width: number): string {
  if (width <= 0) return "";
  if (visibleWidth(text) <= width) return text;
  const limit = Math.max(1, width - 1);
  let out = "";
  let count = 0;
  for (let index = 0; index < text.length;) {
    const escape = /^\x1b\[[0-9;?]*[A-Za-z]/.exec(text.slice(index));
    if (escape) {
      out += escape[0];
      index += escape[0].length;
      continue;
    }
    if (count >= limit) break;
    const point = String.fromCodePoint(text.codePointAt(index)!);
    out += point;
    index += point.length;
    count += 1;
  }
  return `${out}…${RESET}`;
}

/**
 * Color whole segments instead of every character. Per-character gradients emit
 * ~20 bytes per glyph, which is slow on proot/SSH and can tear on narrow terminals.
 */
export function tint(text: string, mode: ReturnType<typeof colorMode>, shift = 0): string {
  if (mode === "none" || text.length === 0) return text;
  const palette = mode === "truecolor"
    ? ["\x1b[38;2;139;92;246m", "\x1b[38;2;124;124;245m", "\x1b[38;2;88;166;242m", "\x1b[38;2;34;211;238m"]
    : ["\x1b[38;5;141m", "\x1b[38;5;140m", "\x1b[38;5;81m", "\x1b[38;5;45m"];
  const color = palette[Math.abs(shift) % palette.length]!;
  return `${color}${text}${RESET}`;
}

export interface LiveLineOptions {
  stream?: Writable;
  env?: NodeJS.ProcessEnv;
  intervalMs?: number;
  plain?: boolean;
  silent?: boolean;
}

/**
 * A single terminal line that redraws in place.
 *
 * Guarantees that fix the "spamming" output:
 *  - every frame is truncated to the real terminal width, so it can never wrap
 *    (a wrapped frame cannot be erased by \x1b[2K and scrolls the screen);
 *  - identical frames are not rewritten;
 *  - writes are coalesced, so a slow stream cannot queue a backlog of frames;
 *  - non-TTY / NO_COLOR / CI output degrades to one line per distinct message.
 */
export class LiveLine {
  private readonly stream: TtyStream;
  private readonly env: NodeJS.ProcessEnv;
  private readonly interactive: boolean;
  private readonly colors: ReturnType<typeof colorMode>;
  private readonly silent: boolean;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | undefined;
  private frame = 0;
  private text = "";
  private lastRendered = "";
  private lastPlain = "";
  private pending = false;
  private active = false;
  private closed = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: LiveLineOptions = {}) {
    this.stream = (options.stream ?? process.stderr) as TtyStream;
    this.env = options.env ?? process.env;
    this.silent = options.silent === true;
    this.intervalMs = Math.max(80, options.intervalMs ?? 120);
    const tty = this.stream.isTTY === true;
    this.interactive = animationEnabled(this.env, tty, options.plain);
    this.colors = colorMode(this.env, tty);
  }

  get isInteractive(): boolean {
    return this.interactive;
  }

  get colorMode(): ReturnType<typeof colorMode> {
    return this.colors;
  }

  width(): number {
    const columns = this.stream.columns;
    if (typeof columns === "number" && columns > 0) return columns;
    const parsed = Number(this.env.COLUMNS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
  }

  /** Write a permanent line, clearing any live frame first. */
  async line(text = ""): Promise<void> {
    if (this.silent) return;
    const prefix = this.active ? CLEAR_LINE : "";
    const body = this.interactive ? truncateVisible(text, this.width()) : text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
    this.write(`${prefix}${body}\n`);
    this.active = false;
    this.lastRendered = "";
    await this.drain();
    if (this.timer) this.render();
  }

  /** Begin animating a status line. */
  begin(text: string): void {
    if (this.closed || this.silent) return;
    this.text = text;
    if (!this.interactive) {
      this.emitPlain(text);
      return;
    }
    this.write(HIDE);
    this.render();
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.frame += 1;
        this.render();
      }, this.intervalMs);
      this.timer.unref();
    }
  }

  /** Update the status text without printing a new line. */
  update(text: string): void {
    if (this.closed || this.silent) return;
    this.text = text;
    if (!this.interactive) {
      this.emitPlain(text);
      return;
    }
    this.render();
  }

  /** Replace the live frame with a permanent result line. */
  async done(text: string): Promise<void> {
    this.stopTimer();
    await this.line(text);
  }

  async close(): Promise<void> {
    if (this.closed) {
      await this.drain();
      return;
    }
    this.closed = true;
    this.stopTimer();
    if (this.interactive && this.active) this.write(CLEAR_LINE);
    if (this.interactive) this.write(SHOW);
    await this.drain();
  }

  async drain(): Promise<void> {
    await this.queue;
  }

  private emitPlain(text: string): void {
    const plain = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
    if (plain === this.lastPlain) return;
    this.lastPlain = plain;
    this.write(`${plain}\n`);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private render(): void {
    if (!this.interactive || this.closed || this.silent || this.pending) return;
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][this.frame % 10]!;
    // Reserve one column: writing into the last cell can auto-wrap on some terms.
    const budget = Math.max(8, this.width() - 1);
    const body = truncateVisible(this.text, Math.max(4, budget - 2));
    const frame = `${tint(spinner, this.colors, this.frame)} ${body}`;
    if (frame === this.lastRendered) return;
    this.lastRendered = frame;
    this.active = true;
    this.pending = true;
    this.write(CLEAR_LINE + frame, () => { this.pending = false; });
  }

  private write(text: string, after?: () => void): void {
    if (this.silent) {
      after?.();
      return;
    }
    this.queue = this.queue
      .then(() => new Promise<void>((resolve) => {
        try {
          this.stream.write(text, () => { after?.(); resolve(); });
        } catch {
          after?.();
          resolve();
        }
      }))
      .catch(() => undefined);
  }
}

export { CLEAR_LINE, HIDE, SHOW, RESET, animationEnabled, blend, colorMode };
