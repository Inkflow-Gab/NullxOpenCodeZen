# Mobile Ubuntu in proot

This guide is for Android phones/tablets running Ubuntu inside Termux `proot-distro`.

It is written as separate copy-paste blocks. The Ubuntu commands do **not** use `sudo`. In the default proot-distro Ubuntu guest you are already root inside the guest, and Node/npm global installs are redirected into your home directory.

> Keep OpenCode open in another tmux window or terminal session while you use Nullx commands elsewhere.

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

## Troubleshooting

### `nullx` is not found

Reload the shell config:

```bash
source "$HOME/.bashrc"
```

Check the local bin directory:

```bash
ls "$HOME/.local/bin"
```

If needed, link again from the project directory:

```bash
npm link
```

### Node is older than 22

Check the active Node:

```bash
node --version
```

Reinstall Node 22 locally:

```bash
n 22
```

Refresh the shell:

```bash
hash -r
```

### OpenCode install failed

Run diagnostics:

```bash
nullx doctor --verbose
```

Repair the managed install:

```bash
nullx install --repair
```

Retry with more attempts:

```bash
nullx install --retries 4
```

### Animation is distracting

Disable animation:

```bash
nullx --no-animation start
```

Disable color:

```bash
nullx --no-color status
```

### Shared storage problems

Keep the repository, npm prefix, and Nullx state inside the Ubuntu home filesystem. Avoid running from shared storage paths such as `/sdcard` or `/storage/emulated/0`, because executable permissions and filesystem behavior can be unreliable there.

### 32-bit ARM

Official OpenCode native binaries are most likely to work on `arm64` or `x64`. If `uname -m` reports a 32-bit ARM userland, use a 64-bit Ubuntu guest/device when possible.

Check architecture:

```bash
uname -m
```
