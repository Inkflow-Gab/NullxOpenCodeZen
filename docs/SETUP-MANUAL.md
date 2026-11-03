# Manual setup, step by step

Every command in its own copy-paste block, for when you want to see each step.

- Fast path: [README](../README.md#-install) — one command.
- Mobile: [MOBILE-PROOT.md](MOBILE-PROOT.md)
- Problems: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 📱 Mobile: Ubuntu in proot, no sudo

Start in **Termux**, not inside Ubuntu yet.

### 1. Update Termux

```bash
pkg update -y
```

### 2. Install proot-distro

```bash
pkg install -y proot-distro
```

### 3. Install Ubuntu

```bash
proot-distro install ubuntu
```

If your proot-distro version requires an explicit image tag, use this instead:

```bash
proot-distro install ubuntu:24.04 --name ubuntu
```

### 4. Enter Ubuntu

```bash
proot-distro login ubuntu
```

Now you are inside Ubuntu. The remaining commands do **not** use `sudo`.

### 5. Update Ubuntu packages

```bash
apt update
```

### 6. Install build and session tools

```bash
apt install -y curl git ca-certificates xz-utils nodejs npm tmux
```

### 7. Use a user-writable npm prefix

```bash
npm config set prefix "$HOME/.local"
```

### 8. Create the local bin directory

```bash
mkdir -p "$HOME/.local/bin"
```

### 9. Add it to PATH for this session

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### 10. Make PATH persistent

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
```

### 11. Install the Node version manager locally

```bash
npm install -g n
```

### 12. Keep Node installs under your home directory

```bash
export N_PREFIX="$HOME/.local"
```

### 13. Make N_PREFIX persistent

```bash
echo 'export N_PREFIX="$HOME/.local"' >> "$HOME/.bashrc"
```

### 14. Install Node 22

```bash
n 22
```

### 15. Refresh the shell command cache

```bash
hash -r
```

### 16. Verify Node

```bash
node --version
```

### 17. Verify npm

```bash
npm --version
```

### 18. Clone Nullx

```bash
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
```

### 19. Enter the project

```bash
cd NullxOpenCodeZen
```

### 20. Install locked dependencies

```bash
npm ci
```

### 21. Build the CLI

```bash
npm run build
```

### 22. Expose the `nullx` command

```bash
node dist/cli.js setup --skip-opencode
```

This installs a launcher into `~/.local/bin` and updates `PATH`. If another program already owns `nullx`, it installs `nullx-zen` instead and prints the name it chose.

> [!TIP]
> `npm link` fails with `EEXIST` when another tool already provides `nullx`. Use `setup` instead — it never clobbers the other program. See [Troubleshooting](docs/TROUBLESHOOTING.md).

### 23. Verify Nullx

```bash
nullx --version
```

### 24. Install OpenCode

```bash
nullx install
```

### 25. Authenticate with your own provider account

```bash
nullx auth login
```

### 26. List available models

```bash
nullx models
```

### 27. Set a default model

Replace `provider/model` with an exact ID printed by the previous command.

```bash
nullx model set provider/model
```

### 28. Run diagnostics

```bash
nullx doctor --verbose
```

### 29. Start OpenCode

```bash
nullx start
```

### Keep OpenCode open in another session

Use `tmux` so OpenCode can stay open while you use another pane or window.

```bash
tmux new -s nullx
```

Inside tmux:

```bash
nullx start
```

Then press `Ctrl-b` followed by `c` to create another tmux window. In the new window:

```bash
nullx status
```

Press `Ctrl-b` followed by `d` to detach. Reattach later:

```bash
tmux attach -t nullx
```

More detail: [docs/MOBILE-PROOT.md](docs/MOBILE-PROOT.md).

## 🐧 Ubuntu / Linux desktop

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

If Node is older than 22, install `n`:

```bash
sudo npm install -g n
```

Then install Node 22:

```bash
sudo n 22
```

Refresh the shell:

```bash
hash -r
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

### 7. Build

```bash
npm run build
```

### 8. Install the command

```bash
node dist/cli.js setup --skip-opencode
```

Setup installs a launcher into `~/.local/bin`, updates `PATH` idempotently, and falls back to `nullx-zen` if another program already owns `nullx`.

Open a new shell, or:

```bash
exec $SHELL
```

You can always use the built entry point directly:

```bash
node dist/cli.js --help
```

### 9. Install OpenCode

```bash
nullx install
```

### 10. Authenticate

```bash
nullx auth login
```

### 11. List models

```bash
nullx models
```

### 12. Set a default model

```bash
nullx model set provider/model
```

### 13. Start

```bash
nullx start
```

## 🪟 Windows PowerShell

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

### 5. Clone Nullx

```powershell
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
```

### 6. Enter the project

```powershell
Set-Location NullxOpenCodeZen
```

### 7. Install locked dependencies

```powershell
npm ci
```

### 8. Build

```powershell
npm run build
```

### 9. Install the command

```powershell
node dist/cli.js setup --skip-opencode
```

Setup installs a `.cmd` launcher under `%LOCALAPPDATA%\nullx-opencode-zen\bin` and adds it to your user `PATH`. Open a new PowerShell window afterwards.

### 10. Install OpenCode

```powershell
nullx install
```

### 11. Authenticate

```powershell
nullx auth login
```

### 12. List models

```powershell
nullx models
```

### 13. Set a default model

```powershell
nullx model set "provider/model"
```

### 14. Start

```powershell
nullx start
```


---

# Mobile proot, manual steps

## 1. Termux host setup

Run these in Termux before entering Ubuntu.

Update Termux packages:

```bash
pkg update -y
```

Install proot-distro:

```bash
pkg install -y proot-distro
```

Install Ubuntu:

```bash
proot-distro install ubuntu
```

If your proot-distro version requires an explicit image tag:

```bash
proot-distro install ubuntu:24.04 --name ubuntu
```

Enter Ubuntu:

```bash
proot-distro login ubuntu
```

## 2. Ubuntu guest setup

Run these inside Ubuntu.

Update package lists:

```bash
apt update
```

Install required tools:

```bash
apt install -y curl git ca-certificates xz-utils nodejs npm tmux
```

Use a user-writable npm prefix:

```bash
npm config set prefix "$HOME/.local"
```

Create the local bin directory:

```bash
mkdir -p "$HOME/.local/bin"
```

Add it to PATH for the current shell:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Persist PATH:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
```

Install `n` locally:

```bash
npm install -g n
```

Keep Node installs under your home directory:

```bash
export N_PREFIX="$HOME/.local"
```

Persist `N_PREFIX`:

```bash
echo 'export N_PREFIX="$HOME/.local"' >> "$HOME/.bashrc"
```

Install Node 22:

```bash
n 22
```

Refresh the shell command cache:

```bash
hash -r
```

Verify Node:

```bash
node --version
```

Verify npm:

```bash
npm --version
```

## 3. Build Nullx

Clone the repository:

```bash
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
```

Enter the project:

```bash
cd NullxOpenCodeZen
```

Install locked dependencies:

```bash
npm ci
```

Build:

```bash
npm run build
```

Link the command:

```bash
npm link
```

Verify:

```bash
nullx --version
```

## 4. Install and connect OpenCode

Install the pinned official OpenCode CLI:

```bash
nullx install
```

Authenticate with your own provider account:

```bash
nullx auth login
```

List models:

```bash
nullx models
```

Set a default model using an exact ID from the previous command:

```bash
nullx model set provider/model
```

Run diagnostics:

```bash
nullx doctor --verbose
```

Start OpenCode:

```bash
nullx start
```

## 5. Keep OpenCode open with tmux

Create a tmux session:

```bash
tmux new -s nullx
```

Start OpenCode inside tmux:

```bash
nullx start
```

Create another tmux window with `Ctrl-b` then `c`.

In the new window, check status:

```bash
nullx status
```

Run a one-shot prompt while the TUI remains open:

```bash
nullx run "Explain this repository and list its test commands"
```

Detach from tmux with `Ctrl-b` then `d`.

Reattach later:

```bash
tmux attach -t nullx
```

## 6. Re-enter after closing Termux

Open Termux again.

Enter Ubuntu:

```bash
proot-distro login ubuntu
```

Enter the project:

```bash
cd NullxOpenCodeZen
```

Reattach tmux if it is still running:

```bash
tmux attach -t nullx
```

If tmux is not running, create a new session:

```bash
tmux new -s nullx
```
