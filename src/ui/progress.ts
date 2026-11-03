import type { Writable } from "node:stream";
import { LiveLine, tint } from "./live-line.js";


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
  private readonly live: LiveLine;
  private readonly total: number;
  private readonly title: string;
  private readonly now: () => number;
  private readonly startedAt: number;
  private index = 0;
  private label = "";
  private detail = "";
  private closed = false;

  constructor(options: ProgressOptions) {
    this.live = new LiveLine({
      ...(options.stream ? { stream: options.stream } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {}),
      ...(options.plain !== undefined ? { plain: options.plain } : {}),
      ...(options.silent !== undefined ? { silent: options.silent } : {}),
    });
    this.total = Math.max(1, options.total);
    this.title = options.title ?? "Nullx OpenCode Zen setup";
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
  }

  columns(): number {
    return this.live.width();
  }

  async banner(ascii: string): Promise<void> {
    if (ascii.trim().length > 0) {
      const width = this.live.width();
      // Skip art that cannot fit rather than letting it wrap into noise.
      const fits = ascii.split("\n").every((line) => line.length <= width);
      if (fits) {
        const colors = this.live.colorMode;
        const rendered = colors === "none"
          ? ascii
          : ascii.split("\n").map((line, index) => tint(line, colors, index)).join("\n");
        for (const line of rendered.split("\n")) await this.live.line(line);
      }
    }
    await this.live.line(tint(this.title, this.live.colorMode, 1));
    await this.live.line();
  }

  async step<T>(label: string, task: (detail: (message: string) => void) => Promise<StepOutcome<T> | T>): Promise<T> {
    if (this.closed) throw new Error("Setup progress is already closed");
    this.index += 1;
    this.label = label;
    this.detail = "";
    const began = this.now();
    const prefix = `[${this.index}/${this.total}]`;

    if (!this.live.isInteractive) await this.live.line(`${prefix} ${label}`);
    else this.live.begin(this.status());

    try {
      const outcome = await task((message) => {
        this.detail = message;
        if (this.live.isInteractive) this.live.update(this.status());
        // In plain mode the live frame is absent, so emit details as sub-lines.
        else void this.live.line(`      ${message}`);
      });
      const value = this.unwrap(outcome);
      const note = value.note ? ` — ${value.note}` : "";
      const summary = `${prefix} ${label} (${this.elapsed(began)})${note}`;
      await this.live.done(this.live.isInteractive
        ? `${tint("✔", this.live.colorMode, this.index)} ${summary}`
        : `  ok ${summary}`);
      return value.value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.live.done(this.live.isInteractive
        ? `\x1b[31m✗ ${prefix} ${label}: ${message}\x1b[0m`
        : `  FAILED ${prefix} ${label}: ${message}`);
      throw error;
    }
  }

  async skip(label: string, reason: string): Promise<void> {
    this.index += 1;
    await this.live.done(`• [${this.index}/${this.total}] ${label} — skipped (${reason})`);
  }

  async line(text = ""): Promise<void> {
    await this.live.line(text);
  }

  /** Release the cursor after any trailing notes have been printed. */
  async close(): Promise<void> {
    await this.live.close();
  }

  async finish(summary: readonly string[]): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const width = Math.max(8, Math.min(24, this.live.width() - 14));
    const colored = this.live.colorMode !== "none";
    await this.live.line();
    await this.live.line(`${tint(progressBar(this.total, this.total, width, colored), this.live.colorMode, 3)} 100%`);
    await this.live.line(`${tint("Setup complete", this.live.colorMode, 2)} in ${this.elapsed(this.startedAt)}`);
    for (const item of summary) await this.live.line(item.length > 0 ? `  ${item}` : "");
    await this.live.close();
  }

  async abort(message: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.live.line();
    await this.live.line(`${tint("Setup stopped", this.live.colorMode)}: ${message}`);
    await this.live.close();
  }

  private status(): string {
    const colored = this.live.colorMode !== "none";
    const width = Math.max(6, Math.min(16, this.live.width() - 44));
    const bar = progressBar(this.index - 1, this.total, width, colored);
    const suffix = this.detail ? ` · ${this.detail}` : "";
    return `[${this.index}/${this.total}] ${bar} ${this.label}${suffix}`;
  }

  private unwrap<T>(outcome: StepOutcome<T> | T): StepOutcome<T> {
    if (typeof outcome === "object" && outcome !== null && "value" in outcome) return outcome as StepOutcome<T>;
    return { value: outcome as T };
  }

  private elapsed(since: number): string {
    const ms = Math.max(0, this.now() - since);
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }
}
