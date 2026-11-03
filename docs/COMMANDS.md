# Command reference

## Global options

Place global options before the command:

```bash
nullx --json status
nullx --home /tmp/nullx-test doctor
nullx --no-color budget
nullx --no-animation start
nullx --version
nullx help run
```

`--no-animation` disables the TTY spinner/gradient animation. `NO_COLOR` or `--no-color` disables color. `NULLX_NO_ANIMATION=1` also disables animation. Non-TTY output uses plain progress lines.

## Database

```bash
nullx db
nullx db --json
nullx config set database auto
nullx config set database shared
nullx config set database channel
```

OpenCode v1 keeps sessions in a `session` table; v2 renames it to `session_v2`. Both default to the same `opencode.db`, so a v1 binary opening a v2 database exits with `Database is not empty and has no session table`.

`nullx db` reports the shared database path, size, detected schema, session tables, and which file the next launch will use. Inspection is **read-only** — it never migrates, rewrites, or deletes an OpenCode database.

Modes (`config.database`, default `auto`):

- `auto` — use the shared database when compatible; otherwise set `OPENCODE_DB` to `opencode-nullx-<channel>.db` for Nullx launches only.
- `shared` — always use the shared file. On a generation mismatch the launch is refused with exit `3` and a suggested fix, rather than crashing inside OpenCode.
- `channel` — always use a dedicated per-channel database.

To use your existing sessions directly instead of isolating, match the channel to the database:

```bash
nullx install --channel v2
```

## Setup

```bash
nullx setup
nullx setup --name nz
nullx setup --force
nullx setup --channel v2
nullx setup --skip-opencode
nullx setup --json
```

All-in-one setup: verifies Node 22+, writes config, installs a launcher, updates `PATH`, checks command resolution, and installs OpenCode. It prints ASCII art, a spinner, and a progress bar on TTYs; plain ordered lines otherwise.

- `--name <command>`: install under a specific name instead of auto-selecting.
- `--bin-dir <path>`: override the launcher directory.
- `--force`: back up a foreign command that owns the name (`<name>.backup-<timestamp>`), then replace it.
- `--channel v1|v2`: choose the OpenCode channel and persist it in config.
- `--retries 0..5`: transient install retries; default 2.
- `--repair`: force a clean managed reinstall.
- `--skip-opencode`: launcher and config only.
- `--no-path`: do not edit shell rc files.
- `--json`: machine-readable result, with no progress output on stderr.

**Collision behavior.** When the target name belongs to another program, setup with no `--name` picks the first free name from `nullx`, `nullx-zen`, `nullx-zen-2`, `nullx-zen-3` and reports the choice. An explicit `--name` that is taken exits `3` (`LAUNCHER_CONFLICT`) unless `--force` is given. Foreign commands are never overwritten silently.

Bootstrap wrappers: `bash scripts/setup.sh` (Linux/macOS/Termux/proot) and `pwsh scripts/setup.ps1` (Windows) additionally install Node 22+ and clone the repository.

## Installation

```bash
nullx install
nullx install --channel v2
nullx install --version 1.19.5 --force
nullx install --repair
nullx install --retries 4
nullx install --dry-run --json
```

- `--channel`: `v1` or `v2`; defaults to the config channel.
- `--version`: exact semver only; tags and ranges are rejected.
- `--force`: reinstall the managed channel even when a matching binary exists.
- `--repair`: force a clean reinstall and remove stale staging/previous artifacts for the target version.
- `--retries`: transient retry attempts after the first try, from 0 to 5; default 2.
- `--dry-run`: print the plan without downloading or writing an install.

`start`, `run`, `auth`, `models`, and `stats` auto-install the configured channel when OpenCode is missing and `autoInstall` is enabled. Disable with `nullx config set auto-install false` or `NULLX_NO_AUTO_INSTALL=1`.

## Launching

```bash
nullx start
nullx start --continue
nullx run "Explain the failing test"
nullx run --model openrouter/vendor/model "Review this diff"
```

`start` consumes one local session unit. `run` consumes one local run unit. Help/version passthrough does not consume a unit. The wrapper reserves the unit before starting OpenCode and records the exit status afterward. A provider error still counts as an attempted launch because it may already have consumed remote quota.

## Providers and models

```bash
nullx auth login
nullx auth list
nullx models
nullx model set opencode/example-model
nullx model show
nullx model clear
nullx stats --days 7
```

Model IDs are examples; use the exact IDs printed by your OpenCode version. Nullx never reads or stores provider credentials. Authentication and provider-specific environment variables remain OpenCode's responsibility.

## Budgets

```bash
nullx budget
nullx budget set --runs 40 --sessions 12
nullx budget set --runs unlimited --sessions unlimited
nullx budget set --warn-at 75 --timezone Asia/Manila
nullx budget reset --yes
```

Limits accept integers from 0 through 1,000,000, or `unlimited`. Zero blocks that launch kind. Reset requires `--yes` and appends a reset event rather than deleting history.

## Configuration

```bash
nullx config init
nullx config init --force
nullx config show
nullx config path
nullx config set channel v2
nullx config set binary /usr/local/bin/opencode
nullx config set model opencode/example-model
nullx config set timezone UTC
nullx config set history-limit 2000
nullx config set auto-install false
nullx config unset binary
nullx config unset model
```

## Reporting

```bash
nullx status --json
nullx doctor --json
nullx doctor --verbose
nullx history --limit 50 --json
nullx paths --json
nullx about
nullx mascot --large
nullx mascot --compact
nullx --no-color mascot --compact
```

`doctor --verbose` lists inspected OpenCode candidates, their source, version/channel, selection reason, and probe errors. `doctor --json` includes environment metadata and the detection report.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | General runtime or storage failure |
| 2 | Invalid command or option |
| 3 | Invalid configuration |
| 4 | Required binary or doctor check missing |
| 5 | Install or registry verification failure |
| 6 | Local daily budget reached |
| 7 | OpenCode process could not start |
| 8 | State lock timeout or failure |

OpenCode's own exit code is propagated for `run`, `start`, `auth`, `models`, and `stats` when the process starts successfully.
