# Troubleshooting

## `npm error EEXIST: file already exists` on `npm link`

Another program already installed a command called `nullx`. Nullx OpenCode Zen will not overwrite it.

Check who owns the name:

```bash
command -v nullx
```

```bash
head -n 3 "$(command -v nullx)"
```

```bash
nullx --version
```

If the output names a different project (for example `Nullx11 Code (free-claude-code ...)`), that is a separate tool that happens to share the name.

### Fix: run setup and keep both tools

```bash
bash scripts/setup.sh
```

Setup detects the collision and installs this project as **`nullx-zen`**, leaving the other program byte-for-byte untouched. Then use:

```bash
nullx-zen --version
```

```bash
nullx-zen start
```

### Fix: take over the `nullx` name on purpose

This backs up the other command first, then installs this project's launcher:

```bash
node dist/cli.js setup --name nullx --force
```

The previous command is saved next to it as `nullx.backup-<timestamp>`. Restore it any time:

```bash
cp ~/.local/bin/nullx.backup-* ~/.local/bin/nullx
```

### Fix: pick any name you like

```bash
node dist/cli.js setup --name nz
```

### What not to do

`npm link --force` overwrites the other tool's entry point with no backup. Prefer `setup --force`, which keeps a restore point.

## `nullx --version` prints a different project

Your shell resolves `nullx` from a directory that comes earlier on `PATH`.

Inspect the resolution order:

```bash
type -a nullx
```

Run diagnostics:

```bash
nullx-zen doctor --verbose
```

The `command` check reports which file wins and whether it belongs to this project.

Put your local bin directory first:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Make it permanent:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

Reload the shell:

```bash
exec $SHELL
```

Or bypass `PATH` entirely:

```bash
node ~/NullxOpenCodeZen/dist/cli.js --version
```

## `nullx: command not found` after setup

Open a new shell so the `PATH` change applies:

```bash
exec $SHELL
```

Confirm the launcher exists:

```bash
ls -l ~/.local/bin
```

If it is missing, rerun setup:

```bash
bash scripts/setup.sh
```

## `Unknown option. Use nullx --help.`

That message comes from the *other* `nullx` program, not this project. This project's help output starts with `Nullx OpenCode Zen` and lists `setup`, `start`, `run`, and `doctor`.

Verify which one you are running:

```bash
nullx --version
```

Then use the name setup installed:

```bash
nullx-zen help
```

## Node is older than 22

Check the version:

```bash
node --version
```

Rerun setup, which installs Node 22 into your home directory without `sudo`:

```bash
bash scripts/setup.sh
```

Or do it manually inside proot Ubuntu:

```bash
export N_PREFIX="$HOME/.local"
```

```bash
n 22
```

```bash
hash -r
```

## Setup animation looks broken

Disable animation:

```bash
bash scripts/setup.sh --no-animation
```

Disable color:

```bash
bash scripts/setup.sh --no-color
```

Read the setup log (the path is printed at the end):

```bash
tail -n 40 /tmp/nullx-setup-*.log
```

## OpenCode install fails

Run diagnostics:

```bash
nullx-zen doctor --verbose
```

Repair the managed install:

```bash
nullx-zen install --repair
```

Retry with more attempts:

```bash
nullx-zen install --retries 4
```

## proot / Termux specifics

Keep the repository and Node installs inside the Ubuntu home filesystem, not `/sdcard`.

Check architecture:

```bash
uname -m
```

`arm64` and `x86_64` are the supported targets for official OpenCode binaries.

See [MOBILE-PROOT.md](MOBILE-PROOT.md) for the full mobile walkthrough.
