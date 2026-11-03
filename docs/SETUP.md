# Setup

## Ubuntu / Linux

### 1. Install prerequisites

```bash
sudo apt update
sudo apt install -y git nodejs npm
node --version
npm --version
```

Node.js must be 22 or newer. If the distribution package is older:

```bash
sudo npm install --global n
sudo n 22
hash -r
node --version
```

### 2. Build Nullx

```bash
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
cd NullxOpenCodeZen
npm ci
npm run check
npm run build
npm link
```

If global linking is not writable, run the built entry point directly:

```bash
node dist/cli.js --help
```

### 3. Install and authenticate OpenCode

```bash
nullx install --dry-run
nullx install
nullx auth login
nullx models
```

Choose a model printed by OpenCode:

```bash
nullx model set <provider/model>
nullx doctor
nullx start
```

### 4. Set a local daily budget

```bash
nullx budget set --runs 30 --sessions 10 --timezone Asia/Manila
nullx budget
```

## Windows PowerShell

### 1. Install prerequisites

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
```

Close and reopen PowerShell, then verify:

```powershell
node --version
npm --version
git --version
```

### 2. Build Nullx

```powershell
git clone https://github.com/Inkflow-Gab/NullxOpenCodeZen.git
Set-Location NullxOpenCodeZen
npm ci
npm run check
npm run build
npm link
```

If script execution policy blocks npm, use `npm.cmd` in place of `npm`, or adjust the policy for your user account according to your organization's setup.

### 3. Install and authenticate OpenCode

```powershell
nullx install --dry-run
nullx install
nullx auth login
nullx models
nullx model set "<provider/model>"
nullx doctor
nullx start
```

## Isolated test installation

Use a separate wrapper home to avoid touching your normal config or journal:

```bash
NULLX_HOME=/tmp/nullx-demo nullx install --dry-run
NULLX_HOME=/tmp/nullx-demo nullx config init
NULLX_HOME=/tmp/nullx-demo nullx status
```

PowerShell:

```powershell
$env:NULLX_HOME = "$env:TEMP\nullx-demo"
nullx install --dry-run
nullx config init
nullx status
Remove-Item Env:NULLX_HOME
```

## Existing OpenCode installation

Nullx checks `NULLX_OPENCODE_BINARY`, then the config's `binaryPath`, then its managed receipt, then `PATH`.

```bash
nullx config set binary /absolute/path/to/opencode
nullx doctor
```

To return to automatic discovery:

```bash
nullx config unset binary
```

## Updating the wrapper

```bash
git pull --ff-only
npm ci
npm run check
npm run build
```

The upstream OpenCode pins are intentionally separate from wrapper updates. See [UPSTREAM.md](UPSTREAM.md).
