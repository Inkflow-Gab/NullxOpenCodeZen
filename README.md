# Nullx OpenCode Zen

<p align="center">
  <img src="assets/nullx-scythe.png" alt="Nullx, a shadowy anime-style guardian holding a scythe" width="280" />
</p>

**A local-first companion CLI for the official [OpenCode](https://github.com/anomalyco/opencode) coding agent.**

Nullx OpenCode Zen is an educational project for learning CLI design, cross-platform process management, pinned dependency installation, and local usage budgeting. It wraps the official `opencode` executable instead of replacing it.

- Detect an existing OpenCode installation, or install a pinned official npm release into a managed directory.
- Enforce **local daily launch budgets** for one-shot runs and interactive sessions.
- Keep a private, prompt-free launch journal with timezone-aware daily rollover.
- Select a default `provider/model` and delegate authentication to OpenCode's own flows.
- Run diagnostics, inspect local history, and view OpenCode's own token/cost statistics.
- Work on Ubuntu/Linux and Windows with no runtime npm dependencies.
- Ship a shadow-and-scythe mascot sprite and a terminal ASCII variant.

> **Quota boundary:** Nullx budgets are local launch counters. They are **not** OpenCode Zen account quotas, token balances, or billing controls. This project does not rotate IPs, hop networks, cycle accounts, or bypass provider limits. If a provider quota is exhausted, wait for its reset or explicitly select another provider you are entitled to use.

## Requirements

- Node.js **22 or newer** with npm
- Git
- Ubuntu/Linux, Windows, or macOS
- An OpenCode-compatible provider account or API key for model access

The wrapper itself does not need an API key. OpenCode handles credentials through its own authentication and environment mechanisms.

## Quick start

### Ubuntu / Linux

Install Node.js 22+ first. If your distribution provides an older Node.js, one option is the `n` version manager:

```bash
sudo apt update
sudo apt install -y git nodejs npm
node --version
```

If the reported version is below 22:

```bash
sudo npm install --global n
sudo n 22
hash -r
node --version
npm --version
```

Clone, build, and expose the `nullx` command:

```bash
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
cd NullxOpenCodeZen
npm ci
npm run build
npm link
```

If `npm link` reports a permissions error, use `node dist/cli.js` in place of `nullx`, or configure a user-writable npm global prefix.

Initialize OpenCode and connect a provider:

```bash
nullx install
nullx auth login
nullx models
nullx model set <provider/model>
nullx doctor
nullx start
```

Run one prompt under the local budget:

```bash
nullx run "Explain this repository and list its test commands"
```

### Windows PowerShell

Install Node.js LTS and Git, then reopen PowerShell:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
node --version
npm --version
git --version
```

Clone, build, and expose the command:

```powershell
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
Set-Location NullxOpenCodeZen
npm ci
npm run build
npm link
```

Initialize OpenCode and connect a provider:

```powershell
nullx install
nullx auth login
nullx models
nullx model set "<provider/model>"
nullx doctor
nullx start
```

For the best OpenCode terminal experience on Windows, the upstream project also documents WSL. Nullx itself supports native Windows paths and avoids spawning npm `.cmd` shims through a shell.

## Daily budgets

Defaults are **30 runs/day**, **10 interactive sessions/day**, and a warning at **80%**. These are local guardrails, not provider quota measurements.

```bash
nullx budget
nullx budget set --runs 40 --sessions 12 --timezone Asia/Manila
nullx budget set --warn-at 75
nullx budget set --runs unlimited
nullx budget reset --yes
```

A run is one `nullx run` invocation. A session is one `nullx start` invocation. The wrapper cannot count individual prompts typed inside an interactive OpenCode session. Counters reset at the next midnight in the configured IANA timezone. `budget reset --yes` clears today's local counters while preserving the journal.

## Commands

| Command | Purpose |
| --- | --- |
| `nullx install [--channel v1\|v2] [--dry-run]` | Detect or install a pinned official OpenCode CLI |
| `nullx start [opencode options]` | Launch the TUI under the local session budget |
| `nullx run [opencode run options] "prompt"` | Launch one non-interactive run under the local run budget |
| `nullx auth [login\|list\|logout ...]` | Delegate to OpenCode authentication |
| `nullx models [options]` | List models through OpenCode |
| `nullx model set <provider/model>` | Set the wrapper's default model |
| `nullx model clear` | Return model selection to OpenCode |
| `nullx stats [options]` | Show OpenCode's own usage statistics |
| `nullx budget [status\|set\|reset]` | Inspect or change local daily launch limits |
| `nullx history [--limit 20] [--json]` | Show local launch metadata |
| `nullx status [--json]` | Show the local dashboard |
| `nullx doctor [--json]` | Check runtime, binary, config, storage, and journal |
| `nullx config [init\|show\|path\|set\|unset]` | Manage wrapper configuration |
| `nullx paths [--json]` | Print storage locations |
| `nullx about` | Show project information and mascot |

Arguments after `start`, `run`, `auth`, `models`, and `stats` are forwarded to OpenCode. For example:

```bash
nullx run --model openrouter/vendor/model "Review the diff"
```

Use `--` only when you need OpenCode's own argument separator, such as passing literal text that begins with a dash.

## Configuration

Create a config file:

```bash
nullx config init
nullx config path
nullx config show
```

Example:

```json
{
  "version": 1,
  "channel": "v1",
  "binaryPath": null,
  "defaultModel": null,
  "autoInstall": true,
  "timezone": "Asia/Manila",
  "historyLimit": 1000,
  "budget": {
    "runsPerDay": 30,
    "sessionsPerDay": 10,
    "warnAtPercent": 80
  }
}
```

Useful edits:

```bash
nullx config set timezone Asia/Manila
nullx config set auto-install false
nullx config set binary /absolute/path/to/opencode
nullx config unset binary
nullx config set history-limit 2000
```

Binary precedence is:

1. `NULLX_OPENCODE_BINARY`
2. `binaryPath` in the wrapper config
3. The managed install receipt
4. The system `PATH`

Set `NULLX_HOME=/some/directory` to isolate config, state, and managed tools for testing. Set `NULLX_NO_AUTO_INSTALL=1` to prevent first-launch installation.

## OpenCode versions

The default channel is `v1`, pinned to `opencode-ai@1.19.5`. The optional `v2` channel is pinned to `@opencode/cli@2.2.5`. Both expose the `opencode` command upstream; Nullx keeps managed versions in separate directories and launches the selected native binary directly.

```bash
nullx install --dry-run
nullx install --channel v1
nullx install --channel v2 --force
```

Installation uses the official npm registry, exact versions, SHA-512 metadata checks, a staging directory, and a post-install `--version` probe. See [docs/UPSTREAM.md](docs/UPSTREAM.md) for the reviewed pins.

## Storage and privacy

| Platform | Config | State | Managed tools |
| --- | --- | --- | --- |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/nullx-opencode-zen` | `${XDG_STATE_HOME:-~/.local/state}/nullx-opencode-zen` | `${XDG_DATA_HOME:-~/.local/share}/nullx-opencode-zen` |
| Windows | `%APPDATA%\nullx-opencode-zen` | `%LOCALAPPDATA%\nullx-opencode-zen\state` | `%LOCALAPPDATA%\nullx-opencode-zen\data` |
| macOS | `~/Library/Application Support/nullx-opencode-zen/config` | `~/Library/Application Support/nullx-opencode-zen/state` | `~/Library/Application Support/nullx-opencode-zen/data` |

The journal stores timestamps, launch kind, selected model, exit status, signal, and duration. It does **not** store prompts, source code, API keys, or provider responses. OpenCode maintains its own sessions and credentials separately.

## Development

```bash
npm ci
npm run check
npm run build
node dist/cli.js --help
```

The implementation is intentionally compact and tested rather than padded to an arbitrary line count. Core behavior lives in small modules under `src/core`; command adapters live under `src/commands`; tests use temporary homes and injected process executors so they do not need a real provider account.

More documentation:

- [Detailed setup](docs/SETUP.md)
- [Command reference](docs/COMMANDS.md)
- [Quota behavior](docs/QUOTAS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Upstream pins](docs/UPSTREAM.md)
- [Contributing](CONTRIBUTING.md)

## Project status

This is a working v0.1 companion CLI, not a fork of OpenCode and not an official OpenCode product. OpenCode is a separate project by its own contributors. Nullx is MIT licensed; the included mascot artwork was generated for this project.
