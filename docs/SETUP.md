# Setup

## Fast path: all-in-one

One copy-paste, animated, no `sudo`, and safe when another program already owns the `nullx` command.

Ubuntu, Linux desktop, WSL, macOS, or proot Ubuntu:

```bash
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git "$HOME/NullxOpenCodeZen" 2>/dev/null; cd "$HOME/NullxOpenCodeZen" && bash scripts/setup.sh
```

Already cloned:

```bash
bash scripts/setup.sh
```

Windows PowerShell:

```powershell
pwsh -ExecutionPolicy Bypass -File scripts/setup.ps1
```

Options:

```bash
bash scripts/setup.sh --name nz --channel v1
```

- `--name <command>`: install under a specific command name.
- `--force`: back up a foreign command that owns the name, then replace it.
- `--channel v1|v2`: choose the OpenCode channel.
- `--skip-opencode`: install the launcher and config only.
- `--no-animation` / `--no-color`: plain output for logs and CI.
- `--dir <path>`: where to clone when run outside the repository.

The equivalent CLI command, once built, is:

```bash
node dist/cli.js setup
```

If you hit `npm error EEXIST` from `npm link`, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Manual path: step by step

Each step is a separate copy-paste block. Run them in order.

- 📱 Android / Termux / proot Ubuntu: [MOBILE-PROOT.md](MOBILE-PROOT.md) — no `sudo` commands.
- 🐧 Ubuntu / Linux desktop: below.
- 🪟 Windows PowerShell: below.

## Ubuntu / Linux desktop

### 1. Update packages

```bash
sudo apt update
```

### 2. Install prerequisites

```bash
sudo apt install -y curl git ca-certificates xz-utils nodejs npm
```

### 3. Check Node

```bash
node --version
```

Node.js must be 22 or newer. If it is older, install `n`:

```bash
sudo npm install -g n
```

Install Node 22:

```bash
sudo n 22
```

Refresh the shell:

```bash
hash -r
```

Verify again:

```bash
node --version
```

### 4. Clone Nullx

```bash
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
```

### 5. Enter the project

```bash
cd NullxOpenCodeZen
```

### 6. Install locked dependencies

```bash
npm ci
```

### 7. Run checks

```bash
npm run check
```

### 8. Build

```bash
npm run build
```

### 9. Install the command

```bash
node dist/cli.js setup --skip-opencode
```

Prefer a plain launcher with no collision handling? `npm link` still works when the name is free, but it fails with `EEXIST` if another tool already provides `nullx`.

If global linking is not writable, run the built entry point directly:

```bash
node dist/cli.js --help
```

### 10. Preview the OpenCode install plan

```bash
nullx install --dry-run
```

### 11. Install OpenCode

```bash
nullx install
```

### 12. Authenticate

```bash
nullx auth login
```

### 13. List models

```bash
nullx models
```

### 14. Set a default model

Replace `provider/model` with an exact ID printed by OpenCode.

```bash
nullx model set provider/model
```

### 15. Run diagnostics

```bash
nullx doctor --verbose
```

### 16. Start

```bash
nullx start
```

### 17. Set a local daily budget

```bash
nullx budget set --runs 30 --sessions 10 --timezone Asia/Manila
```

### 18. Show the budget

```bash
nullx budget
```

## Windows PowerShell

### 1. Install Node.js LTS

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

### 2. Install Git

```powershell
winget install --id Git.Git -e
```

Close and reopen PowerShell.

### 3. Verify Node

```powershell
node --version
```

### 4. Verify npm

```powershell
npm --version
```

### 5. Verify Git

```powershell
git --version
```

### 6. Clone Nullx

```powershell
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
```

### 7. Enter the project

```powershell
Set-Location NullxOpenCodeZen
```

### 8. Install locked dependencies

```powershell
npm ci
```

### 9. Run checks

```powershell
npm run check
```

### 10. Build

```powershell
npm run build
```

### 11. Install the command

```powershell
node dist/cli.js setup --skip-opencode
```

Open a new PowerShell window so the user `PATH` update applies.

If script execution policy blocks npm, use `npm.cmd` in place of `npm`, or adjust the policy for your user account according to your organization's setup.

### 12. Preview the OpenCode install plan

```powershell
nullx install --dry-run
```

### 13. Install OpenCode

```powershell
nullx install
```

### 14. Authenticate

```powershell
nullx auth login
```

### 15. List models

```powershell
nullx models
```

### 16. Set a default model

```powershell
nullx model set "provider/model"
```

### 17. Run diagnostics

```powershell
nullx doctor --verbose
```

### 18. Start

```powershell
nullx start
```

## Isolated test installation

Use a separate wrapper home to avoid touching your normal config or journal.

Linux/macOS:

```bash
NULLX_HOME=/tmp/nullx-demo nullx install --dry-run
```

```bash
NULLX_HOME=/tmp/nullx-demo nullx config init
```

```bash
NULLX_HOME=/tmp/nullx-demo nullx status
```

PowerShell:

```powershell
$env:NULLX_HOME = "$env:TEMP\nullx-demo"
```

```powershell
nullx install --dry-run
```

```powershell
nullx config init
```

```powershell
nullx status
```

```powershell
Remove-Item Env:NULLX_HOME
```

## Existing OpenCode installation

Nullx checks `NULLX_OPENCODE_BINARY`, then the config's `binaryPath`, then its managed receipt, then `PATH`.

Point Nullx at an existing native binary:

```bash
nullx config set binary /absolute/path/to/opencode
```

Run diagnostics:

```bash
nullx doctor --verbose
```

Return to automatic discovery:

```bash
nullx config unset binary
```

## Updating the wrapper

Pull the latest changes:

```bash
git pull --ff-only
```

Install locked dependencies:

```bash
npm ci
```

Run checks:

```bash
npm run check
```

Build:

```bash
npm run build
```

The upstream OpenCode pins are intentionally separate from wrapper updates. See [UPSTREAM.md](UPSTREAM.md).
