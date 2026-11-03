# Architecture

Nullx is a TypeScript/Node.js 22 CLI with no runtime npm dependencies. It wraps the official OpenCode binary; it does not vendor or fork the upstream agent.

## Layers

```text
src/cli.ts                 process entry point and exit code
src/app.ts                 global flags and command dispatch
src/commands/*             command adapters and terminal output
src/core/config.ts         strict JSON config validation and atomic writes
src/core/paths.ts          OS-specific storage and pinned release metadata
src/core/detect.ts         binary precedence, PATH scan, native shim resolution, version probe, candidate report
src/core/install.ts        registry metadata checks, staged npm install, retry/repair, receipt
src/core/environment.ts    Ubuntu/Termux/proot-like/WSL heuristics and mobile hints
src/core/process.ts        shell-free capture and inherited child processes
src/core/budget.ts         reservation, rollover, reset, warning policy
src/core/journal.ts        bounded JSONL validation, append, compaction
src/core/lock.ts           cross-process local state lock
src/core/clock.ts          IANA calendar days and DST-aware reset instant
src/ui/terminal.ts         TTY-aware color, gradients, and simple meters
src/ui/connection-animation.ts  stderr-only preparation animation with plain/NO_COLOR/CI fallbacks
src/ui/banner.ts           large/compact ASCII mascot loading and color rendering
src/utils/args.ts          wrapper flag parsing and passthrough boundaries
```

## Launch flow

```text
parse command
  -> load and validate config
  -> describe environment for proot/WSL/mobile hints
  -> show stderr preparation animation on TTYs
  -> resolve OpenCode binary
  -> optionally install pinned official release with progress/retry
  -> stop animation before handing stdio to OpenCode
  -> inject default model when no explicit model flag exists
  -> acquire journal lock
  -> read journal and check local daily budget
  -> append launch reservation
  -> release lock
  -> spawn OpenCode with inherited stdio and no shell
  -> forward termination signals
  -> append finish event under lock
  -> propagate child exit code
```

The reservation happens before spawn because a started request may consume remote quota even if it later fails. Completion recording failure is reported but does not erase the reservation.

## Install flow

```text
select channel and exact version
  -> reuse matching detected binary unless forced/repair
  -> remove stale staging/previous artifacts when repairing
  -> fetch exact-version metadata from registry.npmjs.org
  -> validate package name, version, HTTPS tarball host, SHA-512 integrity
  -> compare default pins against reviewed integrity constants
  -> npm install into a unique staging prefix, retrying transient failures
  -> locate the native package binary
  -> run --version and compare the result
  -> atomically move staging into the versioned managed directory
  -> write receipt and config channel
```

The official npm packages copy their platform binary to `bin/opencode.exe` on every OS. Nullx launches that file directly. On Windows, known npm `.cmd` shims are resolved to the adjacent native package binary rather than executed through `cmd.exe`.

## Storage guarantees

- Config and receipts are written to a temporary file, flushed, and renamed.
- Journal writes are append-only JSONL under a directory lock.
- Corrupt or oversized journals fail closed.
- Current-day journal records are never removed by history compaction.
- POSIX config/state directories are created with mode 0700 and files with mode 0600. Windows uses the current user's profile directories.
- The journal schema intentionally excludes prompts, code, credentials, and model output.

## Boundaries

- No HTTP server, proxy, network switcher, or account rotator.
- No provider credential parsing.
- No claim that local launch counts equal token usage or remote quota.
- No arbitrary shell execution for forwarded arguments.
- No automatic update to an unpinned `latest` upstream release.

## Testing strategy

Unit tests cover config validation, timezone rollover, budget concurrency, journal corruption, install planning/integrity, binary detection, argument forwarding, and process exit propagation. Launch tests inject a runner so they do not require a provider account. The install tests inject registry metadata and an executor that creates a fixture binary. CI runs the same checks on Ubuntu and Windows.
