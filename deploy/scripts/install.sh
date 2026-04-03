#!/usr/bin/env bash
# install.sh — Unified one-click installer for OpenClaw + Deck.
#
# Usage:
#   deploy/scripts/install.sh              # Interactive menu
#   deploy/scripts/install.sh docker       # Docker mode (build from source)
#   deploy/scripts/install.sh docker-build # Docker mode (force rebuild)
#   deploy/scripts/install.sh bare-metal   # Bare-metal mode (PM2)
#
# This script automatically:
#   - Creates .env from .env.example (with pre-filled credentials)
#   - Installs Node.js 22+ if missing (Linux/macOS/Windows)
#   - Installs pnpm if missing
#   - Installs PM2 if missing (bare-metal mode)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect package root.
# In a package: <pkg>/source/deploy/scripts/install.sh → PACKAGE_ROOT=<pkg>
# In the repo:  <repo>/deploy/scripts/install.sh       → PACKAGE_ROOT=<repo>
if [ -f "$DEPLOY_DIR/../../manifest.json" ]; then
  PACKAGE_ROOT="$(cd "$DEPLOY_DIR/../.." && pwd)"
else
  PACKAGE_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
fi

log() { echo "[install] $*"; }
err() { echo "[install] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
detect_platform() {
  case "$OSTYPE" in
    linux*)  echo "linux" ;;
    darwin*) echo "macos" ;;
    msys*|cygwin*|mingw*) echo "windows" ;;
    *)       echo "unknown" ;;
  esac
}

PLATFORM=$(detect_platform)

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
check_docker() {
  command -v docker >/dev/null 2>&1 || return 1
  docker compose version >/dev/null 2>&1 || return 1
  return 0
}

check_node() {
  command -v node >/dev/null 2>&1 || return 1
  local v
  v=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  [ "$v" -ge 22 ] 2>/dev/null
}

check_pnpm() { command -v pnpm >/dev/null 2>&1; }
check_pm2()  { command -v pm2 >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# Auto-install dependencies
# ---------------------------------------------------------------------------
auto_install_node() {
  if check_node; then return 0; fi

  log "Node.js 22+ not found. Attempting auto-install..."
  case "$PLATFORM" in
    linux)
      if command -v apt-get >/dev/null 2>&1; then
        log "Installing Node.js 22 via NodeSource (apt)..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
      elif command -v yum >/dev/null 2>&1; then
        log "Installing Node.js 22 via NodeSource (yum)..."
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo yum install -y nodejs
      else
        err "Cannot auto-install Node.js: unsupported package manager. Install Node.js 22+ manually."
      fi
      ;;
    macos)
      if command -v brew >/dev/null 2>&1; then
        log "Installing Node.js 22 via Homebrew..."
        brew install node@22
        brew link --overwrite node@22
      else
        err "Cannot auto-install Node.js: Homebrew not found. Install Node.js 22+ manually."
      fi
      ;;
    windows)
      # Check for offline installer in deps/
      local node_msi
      node_msi=$(find "$PACKAGE_ROOT/deps" -name "node-*-x64.msi" 2>/dev/null | head -1)
      if [ -n "$node_msi" ]; then
        log "Found offline Node.js installer: $node_msi"
        log "Please run: msiexec /i \"$node_msi\" /passive"
        err "Run the MSI installer above, then re-run this script."
      elif command -v winget >/dev/null 2>&1; then
        log "Installing Node.js 22 via winget..."
        winget install OpenJS.NodeJS --version 22 --accept-package-agreements --accept-source-agreements
      else
        err "Cannot auto-install Node.js on Windows. Download from https://nodejs.org/"
      fi
      ;;
    *)
      err "Cannot auto-install Node.js on this platform. Install Node.js 22+ manually."
      ;;
  esac

  # Verify
  if ! check_node; then
    err "Node.js installation failed. Please install Node.js 22+ manually."
  fi
  log "Node.js $(node -v) installed successfully"
}

auto_install_pnpm() {
  if check_pnpm; then return 0; fi

  log "pnpm not found. Installing..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm --activate
  else
    npm install -g pnpm
  fi

  if ! check_pnpm; then
    err "pnpm installation failed. Run: npm install -g pnpm"
  fi
  log "pnpm $(pnpm -v) installed successfully"
}

ensure_pm2() {
  if ! check_pm2; then
    log "Installing PM2 globally..."
    npm install -g pm2
  fi
}

ensure_dependencies() {
  local mode="$1"

  if [ "$mode" = "docker" ]; then
    if ! check_docker; then
      log "Docker + Docker Compose v2 is required but not found."
      case "$PLATFORM" in
        linux)
          log "Attempting to install Docker..."
          curl -fsSL https://get.docker.com | sh
          sudo usermod -aG docker "$USER" 2>/dev/null || true
          if ! check_docker; then
            err "Docker installation failed. Install manually: https://docs.docker.com/engine/install/"
          fi
          log "Docker installed. You may need to log out and back in for group changes."
          ;;
        *)
          err "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
          ;;
      esac
    fi
  elif [ "$mode" = "bare-metal" ]; then
    auto_install_node
    auto_install_pnpm
  fi
}

# ---------------------------------------------------------------------------
# .env management
# ---------------------------------------------------------------------------
ensure_env() {
  local env_file="$DEPLOY_DIR/.env"
  if [ ! -f "$env_file" ]; then
    if [ -f "$DEPLOY_DIR/.env.example" ]; then
      cp "$DEPLOY_DIR/.env.example" "$env_file"
      log "Created .env from .env.example (credentials pre-filled)"
    else
      err ".env.example not found. Cannot initialize environment."
    fi
  fi

  # shellcheck disable=SC1090
  source "$env_file"

  # Auto-generate token only if still empty (should not happen with pre-filled example)
  if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    local token
    token=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
    if grep -q "^OPENCLAW_GATEWAY_TOKEN=" "$env_file"; then
      sed -i.bak "s/^OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$token/" "$env_file" && rm -f "$env_file.bak"
    else
      echo "OPENCLAW_GATEWAY_TOKEN=$token" >> "$env_file"
    fi
    log "Generated gateway token"
    # shellcheck disable=SC1090
    source "$env_file"
  fi

  # Export all env vars for child processes
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

# ---------------------------------------------------------------------------
# Manifest reading (for packaged installs)
# ---------------------------------------------------------------------------
read_manifest() {
  local manifest="$PACKAGE_ROOT/manifest.json"
  HAS_SOURCE=true
  HAS_IMAGES=false
  HAS_PREBUILT=false

  if [ -f "$manifest" ]; then
    HAS_IMAGES=$(node -e "const m=JSON.parse(require('fs').readFileSync('$manifest','utf8'));process.stdout.write(String(m.contents?.dockerImages??false))" 2>/dev/null || echo "false")
    HAS_PREBUILT=$(node -e "const m=JSON.parse(require('fs').readFileSync('$manifest','utf8'));process.stdout.write(String(m.contents?.prebuilt??false))" 2>/dev/null || echo "false")
  fi
}

# ---------------------------------------------------------------------------
# Docker install
# ---------------------------------------------------------------------------
docker_install() {
  ensure_dependencies docker
  ensure_env

  # Resolve paths to absolute to avoid ambiguity between install.sh CWD and compose file dir
  local state_dir="${OPENCLAW_STATE_DIR:-$DEPLOY_DIR/data/.openclaw}"
  local deck_data="${DECK_DATA_DIR:-$DEPLOY_DIR/data/openclaw-deck}"
  mkdir -p "$state_dir" "$deck_data"
  state_dir="$(cd "$state_dir" && pwd)"
  deck_data="$(cd "$deck_data" && pwd)"
  export OPENCLAW_STATE_DIR="$state_dir"
  export DECK_DATA_DIR="$deck_data"

  cd "$DEPLOY_DIR/docker"

  # Load pre-built images if available
  if [ -d "$PACKAGE_ROOT/images" ]; then
    for img in "$PACKAGE_ROOT/images"/*.tar.gz; do
      [ -f "$img" ] || continue
      log "Loading $(basename "$img")..."
      docker load < "$img"
    done
  fi

  # Seed: prefer host Node.js, fallback to running inside gateway container
  if check_node; then
    node "$SCRIPT_DIR/seed.js" "$state_dir"
  else
    log "No host Node.js — building gateway image for seed..."
    docker compose --env-file "$DEPLOY_DIR/.env" build gateway
    docker compose --env-file "$DEPLOY_DIR/.env" run --rm --no-deps \
      -v "$SCRIPT_DIR/seed.js:/tmp/seed.js:ro" \
      -v "$DEPLOY_DIR/seed:/tmp/seed:ro" \
      -v "$state_dir:/tmp/state" \
      -e OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}" \
      -e DEFAULT_MODEL="${DEFAULT_MODEL:-}" \
      -e CPA_API_KEY="${CPA_API_KEY:-}" \
      -e CPA_BASE_URL="${CPA_BASE_URL:-}" \
      -e DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}" \
      -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
      -e OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
      gateway node /tmp/seed.js /tmp/state
    log "Seed completed via Docker container"
  fi

  # Start — use pre-built images if loaded, otherwise build from source
  local compose_args=(--env-file "$DEPLOY_DIR/.env")
  if [ "${FORCE_BUILD:-}" = "1" ]; then
    compose_args+=(up -d --build)
  elif docker image inspect openclaw-gateway:package >/dev/null 2>&1 && \
       docker image inspect openclaw-deck:package >/dev/null 2>&1; then
    log "Using pre-built Docker images (openclaw-*:package)"
    compose_args+=(-f docker-compose.yml -f docker-compose.package.yml up -d)
  else
    compose_args+=(up -d --build)
  fi

  log "Starting Docker services..."
  docker compose "${compose_args[@]}"

  log "Waiting for services to start..."
  sleep 8
  docker compose --env-file "$DEPLOY_DIR/.env" ps

  echo ""
  log "=== Installation complete ==="
  log "Gateway: http://localhost:${GATEWAY_PORT:-18789}"
  log "Deck:    http://localhost:${DECK_PORT:-3000}"
  log ""
  log "Manage with:"
  log "  bash $DEPLOY_DIR/status.sh    # Status"
  log "  bash $DEPLOY_DIR/start.sh     # Start"
  log "  bash $DEPLOY_DIR/stop.sh      # Stop"
}

# ---------------------------------------------------------------------------
# Bare-metal install (PM2)
# ---------------------------------------------------------------------------
bare_metal_install() {
  ensure_dependencies bare-metal
  ensure_env
  ensure_pm2

  local source_dir="$PACKAGE_ROOT"
  [ -d "$PACKAGE_ROOT/source" ] && source_dir="$PACKAGE_ROOT/source"
  cd "$source_dir"

  # Install runtime dependencies (always needed, even with pre-built dist)
  if [ ! -d node_modules ]; then
    log "Installing dependencies..."
    # --ignore-scripts: skip native addon compilation (node-llama-cpp etc.)
    # which requires Visual Studio on Windows and is not needed for deployment
    pnpm install --frozen-lockfile --ignore-scripts
  fi

  # Build (skip if pre-built)
  if [ ! -f dist/cli-startup-metadata.json ]; then
    log "Building Gateway..."
    pnpm build
  else
    log "Pre-built Gateway detected, skipping build."
  fi

  if [ ! -f dashboard/.next/standalone/dashboard/server.js ]; then
    log "Building Deck..."
    (cd dashboard && pnpm install && npx next build --webpack)
    # Copy static + public into standalone
    [ -d dashboard/.next/static ] && cp -r dashboard/.next/static dashboard/.next/standalone/dashboard/.next/static
    [ -d dashboard/public ] && cp -r dashboard/public dashboard/.next/standalone/dashboard/public
  else
    log "Pre-built Deck detected, skipping build."
  fi

  # Copy standalone entry point (preloads sql.js before server.js)
  if [ -f dashboard/standalone-entry.mjs ] && [ ! -f dashboard/.next/standalone/dashboard/standalone-entry.mjs ]; then
    cp dashboard/standalone-entry.mjs dashboard/.next/standalone/dashboard/standalone-entry.mjs
    log "Copied standalone-entry.mjs"
  fi

  # Ensure sql.js WASM binary is available in standalone (Next.js trace copies JS but not .wasm)
  local sql_wasm_dst="dashboard/.next/standalone/node_modules/sql.js/dist/sql-wasm.wasm"
  if [ ! -f "$sql_wasm_dst" ]; then
    log "Copying sql-wasm.wasm to standalone..."
    local sql_wasm_src=""
    [ -f "node_modules/sql.js/dist/sql-wasm.wasm" ] && sql_wasm_src="node_modules/sql.js/dist/sql-wasm.wasm"
    [ -z "$sql_wasm_src" ] && [ -f "dashboard/node_modules/sql.js/dist/sql-wasm.wasm" ] && sql_wasm_src="dashboard/node_modules/sql.js/dist/sql-wasm.wasm"
    if [ -n "$sql_wasm_src" ]; then
      mkdir -p "$(dirname "$sql_wasm_dst")"
      cp "$sql_wasm_src" "$sql_wasm_dst"
    else
      log "WARNING: sql-wasm.wasm not found in node_modules — Deck database may fail"
    fi
  fi

  # Seed
  local state_dir="${OPENCLAW_STATE_DIR:-$DEPLOY_DIR/data/.openclaw}"
  mkdir -p "$state_dir"
  node "$SCRIPT_DIR/seed.js" "$state_dir"

  # Generate PM2 config
  node "$SCRIPT_DIR/generate-ecosystem.js" "$source_dir"

  # Clean up any old PM2 processes (prevents stale processes from previous installs)
  pm2 delete openclaw-gateway openclaw-deck 2>/dev/null || pm2 delete all 2>/dev/null || true

  # Start
  pm2 start "$DEPLOY_DIR/ecosystem.config.cjs"
  pm2 save

  echo ""
  log "=== Installation complete ==="
  log "Gateway: http://localhost:${GATEWAY_PORT:-18789}"
  log "Deck:    http://localhost:${DECK_PORT:-3000}"
  log ""
  log "Manage with:"
  log "  bash $DEPLOY_DIR/status.sh    # Status"
  log "  bash $DEPLOY_DIR/start.sh     # Start"
  log "  bash $DEPLOY_DIR/stop.sh      # Stop"
  log ""
  log "Enable auto-start on boot:"
  log "  pm2 startup"
}

# ---------------------------------------------------------------------------
# Interactive menu
# ---------------------------------------------------------------------------
show_menu() {
  read_manifest

  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║     OpenClaw + Deck Installer                ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""
  echo "Platform: $PLATFORM"
  echo ""
  echo "Available modes:"
  echo ""

  if check_docker 2>/dev/null; then
    echo "  1) Docker       — Recommended. Builds from source in containers."
    echo "                     Requires: Docker + Docker Compose v2"
  else
    echo "  1) Docker       — (Docker not detected, will attempt auto-install)"
  fi
  echo ""
  if check_node 2>/dev/null; then
    echo "  2) Bare-metal   — Runs natively with PM2 process manager."
    echo "                     Requires: Node.js 22+, pnpm"
  else
    echo "  2) Bare-metal   — (Node.js not detected, will attempt auto-install)"
  fi
  echo ""
  echo "  q) Quit"
  echo ""

  read -rp "Select mode [1/2/q]: " choice
  case "$choice" in
    1) docker_install ;;
    2) bare_metal_install ;;
    q|Q) echo "Bye."; exit 0 ;;
    *) echo "Invalid choice."; exit 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
case "${1:-}" in
  docker)       docker_install ;;
  docker-build) FORCE_BUILD=1 docker_install ;;
  bare-metal)   bare_metal_install ;;
  "")           show_menu ;;
  *)
    echo "Usage: $0 [docker|docker-build|bare-metal]"
    echo ""
    echo "  docker       — Docker Compose mode (build from source)"
    echo "  docker-build — Docker Compose mode (force rebuild)"
    echo "  bare-metal   — Native mode with PM2"
    echo "  (no args)    — Interactive menu"
    exit 1
    ;;
esac
