# Changelog

## Unreleased

- **Fixed `Database is not empty and has no session table`.** OpenCode v1 (`session`) and v2 (`session_v2`) share one `opencode.db`; a v1 binary cannot open a v2-migrated database. Nullx now inspects the schema read-only before launching and, in the new default `database: auto` mode, points its channel at `opencode-nullx-<channel>.db` via `OPENCODE_DB`. Existing sessions are never modified or deleted.
- New `nullx db` command and a `database` doctor check report the schema generation, session tables, WAL presence, and the file the next launch will use. `nullx config set database auto|shared|channel`.
- **Fixed animation spam on narrow terminals.** Frames were up to 123 columns wide, so they wrapped on a ~40-column phone terminal while `\x1b[2K` erased only one row, leaving residue and scrolling. The new `LiveLine` renderer truncates by visible width, coalesces writes, skips identical frames, and colors whole segments instead of every character.
- Detailed, aligned ASCII mascot generated on a character canvas (`scripts/generate_ascii.py`), with a separate wordmark and automatic size selection: 56 cols → 35 cols → wordmark, so art never wraps.
- **README cut from 692 to ~140 lines** with a single install command, a capability table, and a symptom → fix table. Step-by-step instructions moved to `docs/SETUP-MANUAL.md`; `docs/SETUP.md` and `docs/MOBILE-PROOT.md` trimmed to their fast paths.
- Extracted `src/ui/color.ts` to remove a circular import between the animation and renderer modules.
- 22 new tests (96 total) covering schema detection, isolation modes, read-only guarantees, and per-line width limits at 32/40/50/80 columns.

- **All-in-one setup.** `nullx setup` plus `scripts/setup.sh` and `scripts/setup.ps1` bootstrap Node 22+, dependencies, build, launcher, `PATH`, config, and OpenCode from a single copy-paste, with ASCII art, spinner, progress bar, and plain/NO_COLOR/CI fallbacks.
- **Collision-safe launcher.** `npm link` `EEXIST` is now a solved case: setup detects a foreign `nullx` and installs `nullx-zen` instead, leaving the other program untouched. `--name` picks a name; `--force` backs up the foreign command before replacing it. Idempotent `PATH` updates in `~/.bashrc`/`~/.profile` or the Windows user `PATH`.
- `doctor` reports command resolution and `PATH` shadowing.
- New [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) covering `EEXIST`, shadowed commands, missing launchers, old Node, and proot specifics.
- Launcher, progress, setup command, and bootstrap-script test coverage, including an end-to-end shell test proving a foreign `nullx` stays byte-identical.

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
