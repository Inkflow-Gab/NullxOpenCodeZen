export const EXIT = {
  OK: 0,
  FAILURE: 1,
  USAGE: 2,
  CONFIG: 3,
  NOT_FOUND: 4,
  INSTALL: 5,
  BUDGET: 6,
  UPSTREAM: 7,
  LOCK: 8,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class AppError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: string,
    message: string,
    exitCode: number = EXIT.FAILURE,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function usage(message: string): AppError {
  return new AppError("USAGE", message, EXIT.USAGE);
}
