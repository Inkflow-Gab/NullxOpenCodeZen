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

Every command in its own copy-paste block: **[SETUP-MANUAL.md](SETUP-MANUAL.md)**.

Mobile / Android: **[MOBILE-PROOT.md](MOBILE-PROOT.md)** — no `sudo`.

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
