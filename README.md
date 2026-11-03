<p align="center">
  <img src="assets/nullx-banner.gif" alt="Nullx OpenCode Zen — shadowy scythe mascot with a violet-to-cyan gradient" width="760" />
</p>

<h1 align="center">Nullx OpenCode Zen</h1>

<p align="center"><b>An animated, local-first companion CLI for the official <a href="https://github.com/anomalyco/opencode">OpenCode</a> coding agent.</b></p>

<p align="center">
  <a href="https://github.com/Inkflow-Gab/NullxOpenCodeZen/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Inkflow-Gab/NullxOpenCodeZen/ci.yml?branch=main&style=flat-square&color=8b5cf6" /></a>
  <img alt="Node 22+" src="https://img.shields.io/badge/node-22%2B-22d3ee?style=flat-square" />
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-a78bfa?style=flat-square" />
  <img alt="proot ready" src="https://img.shields.io/badge/proot-Ubuntu-ec4899?style=flat-square" />
</p>

---

## ⚡ Install

**One command.** No `sudo`. Works on Ubuntu, WSL, macOS, and Ubuntu-in-proot on Android.

```bash
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git ~/NullxOpenCodeZen 2>/dev/null; cd ~/NullxOpenCodeZen && bash scripts/setup.sh
```

Windows:

```powershell
pwsh -ExecutionPolicy Bypass -File scripts/setup.ps1
```

Then start it:

```bash
nullx start
```

<sub>Already cloned? Just `bash scripts/setup.sh`. If another program owns the `nullx` name, setup installs **`nullx-zen`** instead and tells you — use that name.</sub>

---

## 🎯 What it does

| | |
| --- | --- |
| 🔎 **Detects or installs OpenCode** | Pinned official npm release, SHA-512 verified |
| 🗄️ **Fixes the v1/v2 database clash** | No more `Database is not empty and has no session table` |
| 🌈 **Animated, not noisy** | One redrawn status line that fits your terminal |
| 🧮 **Local daily budgets** | Cap runs and sessions per day |
| 🔒 **Private history** | Prompt-free launch journal, stored locally |
| 🎯 **Model selection** | Pick a default `provider/model`; auth stays in OpenCode |
| 📱 **proot / Termux ready** | No `sudo`, narrow-terminal safe |
| 🗡️ **Detailed ASCII mascot** | Auto-fits from 56 cols down to a wordmark |

> [!IMPORTANT]
> Nullx budgets are **local launch counters** — not OpenCode Zen account quotas, token balances, or billing limits. This project does not rotate IPs, hop networks, cycle accounts, or bypass provider limits.

---

## 🚀 Daily use

```bash
nullx auth login          # your own provider account
nullx models              # list what you can use
nullx model set opencode/claude-sonnet-4-5
nullx start               # interactive session
nullx run "explain this repo"
```

```bash
nullx doctor              # diagnose anything
nullx budget              # today's local usage
nullx status              # binary, model, budget at a glance
```

**Keep OpenCode open in another session.** Inside proot, use tmux so it survives disconnects:

```bash
tmux new -s nullx
```

<sub>`Ctrl-b c` new window · `Ctrl-b d` detach · `tmux attach -t nullx` reattach</sub>

---

## 🔧 When something breaks

| Symptom | Fix |
| --- | --- |
| `Database is not empty and has no session table` | `nullx db` — then `nullx install --channel v2` |
| `npm error EEXIST` on `npm link` | `bash scripts/setup.sh` |
| `nullx` runs a different program | Use `nullx-zen`, or `nullx doctor` |
| `command not found` after setup | `exec $SHELL` |
| Animation looks broken | `nullx --no-animation start` |

Full guide: **[Troubleshooting](docs/TROUBLESHOOTING.md)**

### About that database error

OpenCode **v1** stores sessions in a `session` table. **v2** renames it to `session_v2`. Both default to the same `opencode.db`, so a v1 binary opening a v2 database dies with that message.

Nullx inspects the schema **read-only** and, when the generations clash, gives its channel a separate database. Your existing sessions are never modified or deleted.

```bash
nullx db                            # show schema, mode, and which file is used
nullx config set database auto      # default: isolate only when needed
nullx install --channel v2          # or match the database you already have
```

---

## 📚 Docs

| Guide | For |
| --- | --- |
| [Setup](docs/SETUP.md) | Fast path and options |
| [Manual setup](docs/SETUP-MANUAL.md) | Every step, one block each |
| [Mobile proot](docs/MOBILE-PROOT.md) | Android / Termux, no `sudo` |
| [Commands](docs/COMMANDS.md) | Full reference |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Fixes for known errors |
| [Quotas](docs/QUOTAS.md) | What local budgets do and don't mean |
| [Architecture](docs/ARCHITECTURE.md) | How it's built |

---

## 🛠️ Development

```bash
npm ci && npm run check && npm run build
```

Zero runtime dependencies · strict TypeScript · 94 tests · Ubuntu + Windows CI on Node 22 and 24.

```bash
npm run dev -- doctor --verbose     # run from source
python3 scripts/generate_ascii.py   # regenerate terminal art
```

---

<p align="center"><sub>Educational project for learning CLI design, cross-platform process management, and pinned dependency installation.<br/>Not affiliated with or endorsed by the OpenCode team. MIT licensed.</sub></p>
