import type { Writable } from "node:stream";
import { describeEnvironment, environmentLabel, type EnvironmentInfo } from "../core/environment.js";
import { LiveLine, tint } from "./live-line.js";
import { animationEnabled, blend, colorMode, type ColorMode } from "./color.js";

export { animationEnabled, blend, colorMode };
export type { ColorMode };

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

export class ConnectionAnimation {
  private readonly live: LiveLine;
  private readonly title: string;
  private readonly reminder: string;
  private readonly successMessage: string;
  private phase = "Checking the local OpenCode runtime";
  private started = false;
  private stopped = false;
  private environment: EnvironmentInfo | undefined;

  constructor(options: AnimationOptions = {}) {
    this.live = new LiveLine({
      ...(options.stream ? { stream: options.stream } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {}),
      ...(options.plain !== undefined ? { plain: options.plain } : {}),
    });
    this.title = options.title ?? "Connecting to OpenCode Zen";
    this.reminder = options.reminder ?? "Keep OpenCode open in your other session.";
    this.successMessage = options.successMessage ?? "OpenCode ready; handing off";
    this.environment = options.environment;
  }

  setEnvironment(environment: EnvironmentInfo): void {
    this.environment = environment;
  }

  setPhase: AnimationPhase = (phase) => {
    if (this.stopped) return;
    this.phase = phase;
    if (this.started) this.live.update(this.status());
  };

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    const colors = this.live.colorMode;
    void this.live.line(tint(this.title, colors, 1));
    void this.live.line(this.reminder);
    if (this.environment) void this.live.line(`Environment: ${environmentLabel(this.environment)}`);
    this.live.begin(this.status());
  }

  async succeed(message = this.successMessage): Promise<void> {
    await this.finish(message, true);
  }

  async fail(message: string): Promise<void> {
    await this.finish(message, false);
  }

  async stop(): Promise<void> {
    await this.live.close();
  }

  private status(): string {
    const suffix = this.environment?.prootLike ? " · proot" : "";
    return `${this.phase}${suffix}`;
  }

  private async finish(message: string, success: boolean): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    const symbol = success ? "✔" : "✗";
    const colors = this.live.colorMode;
    const painted = success ? tint(`${symbol} ${message}`, colors, 3) : `\x1b[31m${symbol} ${message}\x1b[0m`;
    await this.live.done(this.live.isInteractive ? painted : `${success ? "[ok]" : "[fail]"} ${message}`);
    await this.live.close();
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
