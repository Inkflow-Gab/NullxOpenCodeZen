<#
.SYNOPSIS
  Nullx OpenCode Zen — all-in-one Windows setup.
.EXAMPLE
  pwsh scripts/setup.ps1
  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#>
[CmdletBinding()]
param(
  [string]$Name = "",
  [switch]$Force,
  [ValidateSet("v1", "v2")][string]$Channel = "v1",
  [switch]$SkipOpencode,
  [switch]$NoAnimation,
  [switch]$NoColor,
  [string]$Dir = (Join-Path $HOME "NullxOpenCodeZen")
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/Inkflow-Gab/NullxOpenCodeZen.git"
$script:Step = 0
$Total = 5
$UseColor = -not $NoColor -and -not $env:NO_COLOR
$Animate = -not $NoAnimation -and -not $env:CI

function Write-C([string]$Text, [string]$Color) {
  if ($UseColor) { Write-Host $Text -ForegroundColor $Color } else { Write-Host $Text }
}

function Start-Step([string]$Label) {
  $script:Step++
  $filled = [int][Math]::Round($script:Step / $Total * 20)
  $bar = ("#" * $filled) + ("-" * (20 - $filled))
  Write-C ("[{0}/{1}] {2} {3}" -f $script:Step, $Total, $bar, $Label) "Cyan"
}

function Stop-Step([string]$Note) {
  Write-C ("      ok " + $Note) "Green"
}

function Fail([string]$Message) {
  Write-C ("      FAILED: " + $Message) "Red"
  exit 1
}

Write-C @"
      .-''''-.
    .'  /||\  '.
   /   /_||_\   \        /\
  |   ( o  o )   |      / /
   \    ^--^    /      / /
 .--'-.,____,.-'--.   / /
/  N U L L X  / \  \_/ /
\_____________/   \____/
"@ "Magenta"
Write-C "Nullx OpenCode Zen - all-in-one setup`n" "Cyan"

Start-Step "Checking prerequisites"
foreach ($tool in @("node", "npm", "git")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    if ($tool -eq "git") { winget install --id Git.Git -e | Out-Null }
    else { winget install --id OpenJS.NodeJS.LTS -e | Out-Null }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool is still missing. Reopen PowerShell and rerun." }
  }
}
$major = [int]((node --version).TrimStart("v").Split(".")[0])
if ($major -lt 22) { Fail "Node $major is too old. Install Node 22+ and rerun." }
Stop-Step "node $(node --version), npm $(npm --version)"

Start-Step "Preparing repository"
if ((Test-Path "package.json") -and (Select-String -Path "package.json" -Pattern "nullx-opencode-zen" -Quiet)) {
  $RepoDir = (Get-Location).Path
} elseif (Test-Path (Join-Path $Dir ".git")) {
  Set-Location $Dir
  git pull --ff-only | Out-Null
  $RepoDir = $Dir
} else {
  git clone $RepoUrl $Dir | Out-Null
  Set-Location $Dir
  $RepoDir = $Dir
}
Stop-Step $RepoDir

Start-Step "Installing dependencies"
if (Test-Path "package-lock.json") { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) { Fail "npm install failed" }
Stop-Step "dependencies ready"

Start-Step "Building the CLI"
npm run build
if ($LASTEXITCODE -ne 0) { Fail "build failed" }
Stop-Step "dist/cli.js"

Start-Step "Configuring command and OpenCode"
$setupArgs = @("dist/cli.js", "setup", "--channel", $Channel)
if ($Name) { $setupArgs += @("--name", $Name) }
if ($Force) { $setupArgs += "--force" }
if ($SkipOpencode) { $setupArgs += "--skip-opencode" }
if ($NoColor) { $setupArgs = @("--no-color") + $setupArgs }
if ($NoAnimation) { $env:NULLX_NO_ANIMATION = "1" }
node @setupArgs
if ($LASTEXITCODE -ne 0) { Fail "setup failed" }
Stop-Step "done"

Write-C "`nSetup finished. Open a new PowerShell window so PATH changes apply." "Green"
