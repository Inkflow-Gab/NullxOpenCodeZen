# Changelog

## Unreleased

- Animated, colored README banner with static PNG fallback and regeneration script.
- Step-by-step copy-paste setup docs for Ubuntu/Linux, Windows, and mobile proot Ubuntu.
- Mobile proot guide and tests ensuring setup command blocks do not use `sudo`.
- TTY connection-preparation animation with violet/cyan gradients, plain fallbacks, `--no-animation`, and cursor cleanup.
- Environment detection for Ubuntu, Termux-linked sessions, proot-like guests, WSL, and architecture hints.
- `doctor --verbose` and JSON detection reports for binary candidates, stale receipts, and v1/v2 visibility.
- Install progress reporting, transient retries, `--repair`, and stale staging cleanup.
- `nullx mascot --large|--compact` plus gradient/NO_COLOR ASCII rendering.
- CI push workflow now covers `arena/**` branches.

## 0.1.0 — 2026-11-03

- Initial TypeScript/Node.js companion CLI for official OpenCode.
- Pinned v1/v2 managed installation with registry integrity checks and version probing.
- Cross-platform binary detection without shell-based argument forwarding.
- Local daily run/session budgets, IANA timezone rollover, warnings, and explicit reset.
- Private prompt-free JSONL launch journal with locking, validation, and compaction.
- Config, model selection, doctor, status, history, paths, and OpenCode auth/models/stats passthrough.
- Ubuntu/Linux and Windows setup documentation.
- Shadow-and-scythe mascot sprite and terminal ASCII art.
- Unit and CLI tests with Ubuntu/Windows CI matrix.
