import type { Writable } from "node:stream";
import { describeEnvironment, environmentLabel, type EnvironmentInfo } from "../core/environment.js";

export interface AnimationOptions {
  stream?: Writable;
  env?: NodeJS.ProcessEnv;
  intervalMs?: number;
  plain?: boolean;
  title?: string;
  reminder?: string;
  successMessage?: string;
  environment?: EnvironmentInfo;
}

export type AnimationPhase = (phase: string) => void;

const RESET = "\x1b[0m";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const CLEAR_LINE = "\x1b[2K\r";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const VIOLET = [139, 92, 246] as const;
const CYAN = [34, 211, 238] as const;
const FALLBACK_COLORS = [141, 140, 139, 110, 81, 80, 51, 45];

type ColorMode = "truecolor" | "256" | "none";
type TtyStream = Writable & { isTTY?: boolean; columns?: number };

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

export class ConnectionAnimation {
  private readonly stream: TtyStream;
  private readonly env: NodeJS.ProcessEnv;
  private readonly intervalMs: number;
  private readonly interactive: boolean;
  private readonly colors: ColorMode;
  private readonly title: string;
  private readonly reminder: string;
  private readonly successMessage: string;
  private timer: NodeJS.Timeout | undefined;
  private frame = 0;
  private phase = "Checking the local OpenCode runtime";
  private started = false;
  private stopped = false;
  private environment: EnvironmentInfo | undefined;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: AnimationOptions = {}) {
    this.stream = (options.stream ?? process.stderr) as TtyStream;
    this.env = options.env ?? process.env;
    this.intervalMs = Math.max(60, options.intervalMs ?? 90);
    const tty = this.stream.isTTY === true;
    this.interactive = animationEnabled(this.env, tty, options.plain);
    this.colors = colorMode(this.env, tty);
    this.title = options.title ?? "Trying to connect to OpenCode Zen through OpenCode";
    this.reminder = options.reminder ?? "If OpenCode is already open in another session, keep that session open.";
    this.successMessage = options.successMessage ?? "OpenCode runtime ready; handing off to OpenCode";
    this.environment = options.environment;
  }

  setEnvironment(environment: EnvironmentInfo): void {
    this.environment = environment;
  }

  setPhase: AnimationPhase = (phase) => {
    if (this.stopped) return;
    this.phase = phase;
    if (!this.interactive && this.started) this.enqueue(`... ${phase}\n`);
  };

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    const label = this.environment ? environmentLabel(this.environment) : undefined;
    if (this.interactive) {
      this.enqueue(HIDE_CURSOR);
      this.enqueue(`${blend(this.title, this.colors)}\n`);
      this.enqueue(`${this.reminder}\n`);
      if (label) this.enqueue(`Environment: ${label}\n`);
      this.render();
      this.timer = setInterval(() => this.render(), this.intervalMs);
      this.timer.unref();
      return;
    }
    this.enqueue(`${this.title}\n`);
    this.enqueue(`${this.reminder}\n`);
    if (label) this.enqueue(`Environment: ${label}\n`);
    this.enqueue(`... ${this.phase}\n`);
  }

  async succeed(message = this.successMessage): Promise<void> {
    await this.finish(message, true);
  }

  async fail(message: string): Promise<void> {
    await this.finish(message, false);
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      await this.writeQueue;
      return;
    }
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.interactive) this.enqueue(CLEAR_LINE + SHOW_CURSOR);
    await this.writeQueue;
  }

  private render(): void {
    if (!this.interactive || this.stopped) return;
    const spinner = SPINNER[this.frame % SPINNER.length] ?? SPINNER[0]!;
    const columns = this.stream.columns ?? 80;
    const maxWidth = Math.max(30, columns - 2);
    const suffix = this.environment?.prootLike ? " · proot" : "";
    const message = `${spinner} ${this.phase}${suffix}`.slice(0, maxWidth);
    this.frame += 1;
    this.enqueue(CLEAR_LINE + blend(message, this.colors, this.frame));
  }

  private async finish(message: string, success: boolean): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.interactive) {
      const symbol = success ? "✓" : "✗";
      this.enqueue(CLEAR_LINE + blend(`${symbol} ${message}`, this.colors) + "\n" + SHOW_CURSOR);
    } else {
      const plainSymbol = success ? "[ok]" : "[fail]";
      this.enqueue(`${plainSymbol} ${message}\n`);
    }
    await this.writeQueue;
  }

  private enqueue(text: string): void {
    this.writeQueue = this.writeQueue
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

export async function withConnectionAnimation<T>(
  task: (phase: AnimationPhase) => Promise<T>,
  options: AnimationOptions = {},
): Promise<T> {
  const animation = new ConnectionAnimation(options);
  try {
    animation.setEnvironment(options.environment ?? await describeEnvironment({ env: options.env ?? process.env }));
    animation.start();
    const result = await task(animation.setPhase);
    await animation.succeed();
    return result;
  } catch (error) {
    await animation.fail("OpenCode preparation failed; see the error below");
    throw error;
  } finally {
    await animation.stop();
  }
}
