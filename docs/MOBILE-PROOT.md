# Mobile Ubuntu in proot

This guide is for Android phones/tablets running Ubuntu inside Termux `proot-distro`.

It is written as separate copy-paste blocks. The Ubuntu commands do **not** use `sudo`. In the default proot-distro Ubuntu guest you are already root inside the guest, and Node/npm global installs are redirected into your home directory.

> Keep OpenCode open in another tmux window or terminal session while you use Nullx commands elsewhere.

## 0. Fast path: one copy-paste inside Ubuntu

Do section 1 first if you have not installed Ubuntu in proot yet. Once you are at an Ubuntu prompt, this single block does everything else — packages, Node 22, clone, build, launcher, `PATH`, and OpenCode — with a spinner and progress bar, and **no `sudo`**:

```bash
apt update && apt install -y curl git ca-certificates xz-utils && git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git "$HOME/NullxOpenCodeZen" 2>/dev/null; cd "$HOME/NullxOpenCodeZen" && bash scripts/setup.sh
```

Already cloned:

```bash
bash scripts/setup.sh
```

Then apply the `PATH` change:

```bash
exec $SHELL
```

If setup reports that another program owns `nullx`, it installed `nullx-zen` instead. Use that name for every command below, or run:

```bash
bash scripts/setup.sh --name nullx --force
```

The rest of this document is the manual, step-by-step version.

## 1. Manual steps

Prefer to run each command yourself? See **[SETUP-MANUAL.md](SETUP-MANUAL.md#mobile-proot-manual-steps)**.

## Troubleshooting

### `npm error EEXIST` when running `npm link`

Another program already installed a command called `nullx`. Check who owns it:

```bash
head -n 3 "$(command -v nullx)"
```

Run setup instead of `npm link`. It installs `nullx-zen` alongside the other tool:

```bash
bash scripts/setup.sh
```

Full details: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

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
