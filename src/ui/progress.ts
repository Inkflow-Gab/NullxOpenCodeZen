import type { Writable } from "node:stream";
import { animationEnabled, blend, colorMode } from "./connection-animation.js";

type TtyStream = Writable & { isTTY?: boolean; columns?: number };

const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
const CLEAR = "\x1b[2K\r";
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface StepOutcome<T> {
  value: T;
  note?: string;
}

export interface ProgressOptions {
  stream?: Writable;
  env?: NodeJS.ProcessEnv;
  total: number;
  title?: string;
  intervalMs?: number;
  now?: () => number;
  plain?: boolean;
  silent?: boolean;
}

export function progressBar(done: number, total: number, width: number, colored: boolean): string {
  const safeTotal = Math.max(1, total);
  const filled = Math.max(0, Math.min(width, Math.round((done / safeTotal) * width)));
  if (!colored) return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/**
 * Step-by-step setup renderer: gradient banner, spinner, progress bar, elapsed time.
 * Falls back to plain ordered lines when the stream is not a TTY, when NO_COLOR is
 * set, in CI, or when animation is disabled.
 */
export class SetupProgress {
  private readonly stream: TtyStream;
  private readonly env: NodeJS.ProcessEnv;
  private readonly total: number;
  private readonly title: string;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly interactive: boolean;
  private readonly colors: ReturnType<typeof colorMode>;
  private readonly startedAt: number;
  private index = 0;
  private frame = 0;
  private label = "";
  private detail = "";
  private timer: NodeJS.Timeout | undefined;
  private closed = false;
  private readonly silent: boolean;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: ProgressOptions) {
    this.silent = options.silent === true;
    this.stream = (options.stream ?? process.stderr) as TtyStream;
    this.env = options.env ?? process.env;
    this.total = Math.max(1, options.total);
    this.title = options.title ?? "Nullx OpenCode Zen setup";
    this.intervalMs = Math.max(60, options.intervalMs ?? 90);
    this.now = options.now ?? (() => Date.now());
    const tty = this.stream.isTTY === true;
    this.interactive = animationEnabled(this.env, tty, options.plain);
    this.colors = colorMode(this.env, tty);
    this.startedAt = this.now();
  }

  async banner(ascii: string): Promise<void> {
    if (ascii.trim().length > 0) {
      const rendered = this.colors === "none"
        ? ascii
        : ascii.split("\n").map((line, index) => blend(line, this.colors, index)).join("\n");
      this.write(`${rendered}\n`);
    }
    this.write(`${blend(this.title, this.colors)}\n\n`);
    await this.drain();
  }

  async step<T>(label: string, task: (detail: (message: string) => void) => Promise<StepOutcome<T> | T>): Promise<T> {
    if (this.closed) throw new Error("Setup progress is already closed");
    this.index += 1;
    this.label = label;
    this.detail = "";
    const began = this.now();
    const prefix = `[${this.index}/${this.total}]`;

    if (!this.interactive) {
      this.write(`${prefix} ${label}\n`);
      try {
        const outcome = await task((message) => this.write(`      ${message}\n`));
        const value = this.unwrap(outcome);
        this.write(`      ok ${label} (${this.elapsed(began)})${value.note ? ` — ${value.note}` : ""}\n`);
        await this.drain();
        return value.value;
      } catch (error) {
        this.write(`      FAILED ${label}: ${error instanceof Error ? error.message : String(error)}\n`);
        await this.drain();
        throw error;
      }
    }

    this.write(HIDE);
    this.render();
    this.timer = setInterval(() => this.render(), this.intervalMs);
    this.timer.unref();
    try {
      const outcome = await task((message) => {
        this.detail = message;
        this.render();
      });
      const value = this.unwrap(outcome);
      this.stopTimer();
      const tick = blend("✔", this.colors, this.index);
      this.write(`${CLEAR}${tick} ${prefix} ${label} (${this.elapsed(began)})${value.note ? ` — ${value.note}` : ""}\n`);
      await this.drain();
      return value.value;
    } catch (error) {
      this.stopTimer();
      const cross = `\x1b[31m✗\x1b[0m`;
      this.write(`${CLEAR}${cross} ${prefix} ${label}: ${error instanceof Error ? error.message : String(error)}\n`);
      await this.drain();
      throw error;
    } finally {
      this.stopTimer();
      this.write(SHOW);
    }
  }

  async skip(label: string, reason: string): Promise<void> {
    this.index += 1;
    const prefix = `[${this.index}/${this.total}]`;
    this.write(`${blend("•", this.colors, this.index)} ${prefix} ${label} — skipped (${reason})\n`);
    await this.drain();
  }

  async line(text = ""): Promise<void> {
    this.write(`${text}\n`);
    await this.drain();
  }

  async finish(summary: readonly string[]): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.stopTimer();
    const width = this.interactive ? 28 : 20;
    this.write(`\n${blend(progressBar(this.total, this.total, width, this.colors !== "none"), this.colors)} 100%\n`);
    this.write(`${blend("Setup complete", this.colors)} in ${this.elapsed(this.startedAt)}\n`);
    for (const item of summary) this.write(`  ${item}\n`);
    if (this.interactive) this.write(SHOW);
    await this.drain();
  }

  async abort(message: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.stopTimer();
    this.write(`\n${blend("Setup stopped", this.colors)}: ${message}\n`);
    if (this.interactive) this.write(SHOW);
    await this.drain();
  }

  private unwrap<T>(outcome: StepOutcome<T> | T): StepOutcome<T> {
    if (typeof outcome === "object" && outcome !== null && "value" in outcome) return outcome as StepOutcome<T>;
    return { value: outcome as T };
  }

  private elapsed(since: number): string {
    const ms = Math.max(0, this.now() - since);
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private render(): void {
    if (!this.interactive || this.closed) return;
    const spinner = FRAMES[this.frame % FRAMES.length] ?? FRAMES[0]!;
    this.frame += 1;
    const columns = Math.max(40, this.stream.columns ?? 80);
    const width = Math.max(8, Math.min(24, columns - 46));
    const bar = progressBar(this.index - 1, this.total, width, true);
    const suffix = this.detail ? ` · ${this.detail}` : "";
    const text = `${spinner} [${this.index}/${this.total}] ${blend(bar, this.colors, this.frame)} ${this.label}${suffix}`;
    this.write(CLEAR + blend(text, this.colors, this.frame).slice(0, Math.max(60, columns * 12)));
  }

  private async drain(): Promise<void> {
    await this.queue;
  }

  private write(text: string): void {
    if (this.silent) return;
    this.queue = this.queue
      .then(() => new Promise<void>((resolve) => {
        try {
          this.stream.write(text, () => resolve());
        } catch {
          resolve();
        }
      }))
      .catch(() => undefined);
  }
}
