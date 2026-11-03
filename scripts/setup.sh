#!/usr/bin/env bash
# Nullx OpenCode Zen — all-in-one setup.
#
#   bash scripts/setup.sh
#
# Works on Ubuntu/Linux, macOS, Termux, and Ubuntu inside proot-distro.
# Never uses sudo. Never overwrites another program's `nullx` command.
#
# Options:
#   --name <command>    Command name to install (default: auto, falls back to nullx-zen)
#   --force             Back up and replace a foreign command with the same name
#   --channel v1|v2     OpenCode channel (default v1)
#   --skip-opencode     Set up the CLI only
#   --no-animation      Plain progress output
#   --no-color          Disable color
#   --dir <path>        Clone location when run outside the repo
#   --help              Show this help

set -euo pipefail

REPO_URL="https://github.com/Inkflow-Gab/NullxOpenCodeZen.git"
COMMAND_NAME=""
FORCE=0
CHANNEL="v1"
SKIP_OPENCODE=0
ANIMATE=1
COLOR=1
CLONE_DIR="${HOME}/NullxOpenCodeZen"
NODE_MAJOR_MIN=22

while [ $# -gt 0 ]; do
  case "$1" in
    --name) COMMAND_NAME="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --channel) CHANNEL="${2:-}"; shift 2 ;;
    --skip-opencode) SKIP_OPENCODE=1; shift ;;
    --no-animation) ANIMATE=0; shift ;;
    --no-color) COLOR=0; shift ;;
    --dir) CLONE_DIR="${2:-}"; shift 2 ;;
    --help|-h) sed -n '2,22p' "$0"; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
done

[ -n "${NO_COLOR:-}" ] && COLOR=0
[ -n "${CI:-}" ] && ANIMATE=0
[ "${TERM:-}" = "dumb" ] && ANIMATE=0
[ ! -t 2 ] && ANIMATE=0

if [ "$COLOR" -eq 1 ]; then
  VIOLET=$'\033[38;5;141m'; CYAN=$'\033[38;5;45m'; GREEN=$'\033[38;5;42m'
  RED=$'\033[38;5;203m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  VIOLET=""; CYAN=""; GREEN=""; RED=""; DIM=""; BOLD=""; RESET=""
fi

TOTAL=6
STEP=0
SPIN_PID=""
LOG_FILE="${TMPDIR:-/tmp}/nullx-setup-$$.log"
: > "$LOG_FILE"

cleanup() {
  if [ -n "$SPIN_PID" ] && kill -0 "$SPIN_PID" 2>/dev/null; then
    kill "$SPIN_PID" 2>/dev/null || true
    wait "$SPIN_PID" 2>/dev/null || true
  fi
  printf '\033[?25h' >&2 2>/dev/null || true
}
trap cleanup EXIT INT TERM

banner() {
  printf '%s' "$VIOLET" >&2
  cat >&2 <<'ART'
        .-''''-.
      .'  /||\  '.
     /   /_||_\   \        /\
    |   ( o  o )   |      / /
     \    ^--^    /      / /
   .--'-.,____,.-'--.   / /
  /  N U L L X  / \  \_/ /
 /_____________/   \____/
     /  /    \  \
    _/__/      \__\_
ART
  printf '%s\n' "$RESET" >&2
  printf '%sNullx OpenCode Zen%s — all-in-one setup\n\n' "$BOLD$CYAN" "$RESET" >&2
}

bar() {
  local width=24 filled i out=""
  filled=$(( ${STEP:-0} * width / ${TOTAL:-1} ))
  for ((i = 0; i < width; i++)); do
    if [ "$i" -lt "$filled" ]; then out="${out}█"; else out="${out}░"; fi
  done
  printf '%s%s%s' "$CYAN" "$out" "$RESET"
}

start_step() {
  STEP=$(( STEP + 1 ))
  LABEL="$1"
  printf '%s[%d/%d]%s %s %s' "$DIM" "$STEP" "$TOTAL" "$RESET" "$(bar)" "$LABEL" >&2
  if [ "$ANIMATE" -eq 1 ]; then
    printf '\033[?25l' >&2
    (
      trap 'exit 0' TERM INT
      frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
      i=0
      while :; do
        ch="${frames:$((i % 10)):1}"
        printf '\r%s[%d/%d]%s %s %s%s%s %s' "$DIM" "$STEP" "$TOTAL" "$RESET" "$(bar)" "$VIOLET" "$ch" "$RESET" "$LABEL" >&2
        i=$((i + 1))
        sleep 0.09
      done
    ) &
    SPIN_PID=$!
  else
    printf '\n' >&2
  fi
}

stop_step() {
  local status="$1" note="${2:-}"
  if [ -n "$SPIN_PID" ]; then
    kill "$SPIN_PID" 2>/dev/null || true
    wait "$SPIN_PID" 2>/dev/null || true
    SPIN_PID=""
    printf '\033[?25h' >&2
  fi
  printf '\r\033[2K' >&2
  if [ "$status" -eq 0 ]; then
    printf '%s✔%s %s[%d/%d]%s %s %s%s%s\n' "$GREEN" "$RESET" "$DIM" "$STEP" "$TOTAL" "$RESET" "$(bar)" "$LABEL" "$DIM" "${note:+ — $note}$RESET" >&2
  else
    printf '%s✗%s %s[%d/%d]%s %s failed\n' "$RED" "$RESET" "$DIM" "$STEP" "$TOTAL" "$RESET" "$LABEL" >&2
    printf '%sLast log lines (%s):%s\n' "$RED" "$LOG_FILE" "$RESET" >&2
    tail -n 25 "$LOG_FILE" >&2 || true
    exit 1
  fi
}

run_logged() {
  if "$@" >> "$LOG_FILE" 2>&1; then return 0; else return 1; fi
}

have() { command -v "$1" >/dev/null 2>&1; }

banner

# ---------------------------------------------------------------- 1. environment
start_step "Checking environment"
PLATFORM="$(uname -s)"
ARCH="$(uname -m)"
PROOT_HINT="no"
if [ -r /proc/version ] && grep -qi android /proc/version 2>/dev/null; then PROOT_HINT="yes"; fi
if [ -n "${PROOT_TMP_DIR:-}${PREFIX:-}" ]; then PROOT_HINT="yes"; fi
stop_step 0 "$(uname -s) ${ARCH}${PROOT_HINT:+, proot-like: $PROOT_HINT}"

case "$PLATFORM" in
  Linux|Darwin) ;;
  *) printf '%sThis script supports Linux, macOS, Termux, and proot. On Windows run: pwsh scripts/setup.ps1%s\n' "$RED" "$RESET" >&2; exit 1 ;;
esac

# ---------------------------------------------------------------- 2. repository
start_step "Preparing repository"
if [ -f "package.json" ] && grep -q '"nullx-opencode-zen"' package.json 2>/dev/null; then
  REPO_DIR="$PWD"
  note="using current directory"
else
  if ! have git; then
    if have pkg; then run_logged pkg install -y git || { stop_step 1; exit 1; }
    elif have apt-get; then run_logged apt-get update && run_logged apt-get install -y git || { stop_step 1; exit 1; }
    else stop_step 1; exit 1; fi
  fi
  if [ -d "$CLONE_DIR/.git" ]; then
    cd "$CLONE_DIR"
    run_logged git pull --ff-only || true
    note="updated $CLONE_DIR"
  else
    run_logged git clone "$REPO_URL" "$CLONE_DIR" || { stop_step 1; exit 1; }
    cd "$CLONE_DIR"
    note="cloned to $CLONE_DIR"
  fi
  REPO_DIR="$PWD"
fi
stop_step 0 "$note"

# ---------------------------------------------------------------- 3. node
start_step "Ensuring Node ${NODE_MAJOR_MIN}+"
export N_PREFIX="${HOME}/.local"
export PATH="${N_PREFIX}/bin:${PATH}"
node_major() { node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1; }
CURRENT_MAJOR="$(node_major || echo 0)"
if [ -z "$CURRENT_MAJOR" ] || [ "$CURRENT_MAJOR" -lt "$NODE_MAJOR_MIN" ] 2>/dev/null; then
  if have pkg; then
    run_logged pkg install -y nodejs-lts git || run_logged pkg install -y nodejs git || true
  elif have apt-get; then
    run_logged apt-get update || true
    run_logged apt-get install -y curl ca-certificates xz-utils nodejs npm || true
  fi
  hash -r 2>/dev/null || true
  CURRENT_MAJOR="$(node_major || echo 0)"
  if [ -z "$CURRENT_MAJOR" ] || [ "$CURRENT_MAJOR" -lt "$NODE_MAJOR_MIN" ] 2>/dev/null; then
    if ! have npm; then stop_step 1; exit 1; fi
    mkdir -p "${N_PREFIX}/bin"
    npm config set prefix "$N_PREFIX" >> "$LOG_FILE" 2>&1 || true
    run_logged npm install -g n || { stop_step 1; exit 1; }
    run_logged n "$NODE_MAJOR_MIN" || { stop_step 1; exit 1; }
    hash -r 2>/dev/null || true
  fi
fi
CURRENT_MAJOR="$(node_major || echo 0)"
if [ -z "$CURRENT_MAJOR" ] || [ "$CURRENT_MAJOR" -lt "$NODE_MAJOR_MIN" ] 2>/dev/null; then
  stop_step 1; exit 1
fi
stop_step 0 "node $(node --version), npm $(npm --version 2>/dev/null || echo '?')"

# ---------------------------------------------------------------- 4. dependencies
start_step "Installing dependencies"
cd "$REPO_DIR"
if [ -f package-lock.json ]; then
  run_logged npm ci --no-audit --no-fund || run_logged npm install --no-audit --no-fund || { stop_step 1; exit 1; }
else
  run_logged npm install --no-audit --no-fund || { stop_step 1; exit 1; }
fi
stop_step 0 "locked dependencies ready"

# ---------------------------------------------------------------- 5. build
start_step "Building the CLI"
run_logged npm run build || { stop_step 1; exit 1; }
[ -f dist/cli.js ] || { stop_step 1; exit 1; }
stop_step 0 "dist/cli.js"

# ---------------------------------------------------------------- 6. setup
start_step "Configuring command and OpenCode"
SETUP_ARGS=(setup --channel "$CHANNEL")
[ -n "$COMMAND_NAME" ] && SETUP_ARGS+=(--name "$COMMAND_NAME")
[ "$FORCE" -eq 1 ] && SETUP_ARGS+=(--force)
[ "$SKIP_OPENCODE" -eq 1 ] && SETUP_ARGS+=(--skip-opencode)
[ "$COLOR" -eq 0 ] && SETUP_ARGS=(--no-color "${SETUP_ARGS[@]}")
printf '\n' >&2
if node dist/cli.js "${SETUP_ARGS[@]}"; then
  stop_step 0 "done"
else
  stop_step 1
  exit 1
fi

printf '\n%s%sSetup finished.%s Log: %s\n' "$BOLD" "$GREEN" "$RESET" "$LOG_FILE" >&2
printf '%sOpen a new shell (or run: exec $SHELL) so PATH changes apply.%s\n' "$DIM" "$RESET" >&2
