#!/usr/bin/env bash
# install.sh — Unified installer for OpenClaw + Deck.
#
# Usage:
#   deploy/scripts/install.sh              # Interactive menu
#   deploy/scripts/install.sh docker       # Docker mode (build from source)
#   deploy/scripts/install.sh docker-build # Docker mode (force rebuild)
#   deploy/scripts/install.sh bare-metal   # Bare-metal mode (PM2)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect package root.
# In a package: <pkg>/source/deploy/scripts/install.sh → PACKAGE_ROOT=<pkg>
# In the repo:  <repo>/deploy/scripts/install.sh       → PACKAGE_ROOT=<repo>
# The package top-level forwarder (install.sh) already resolves to source/deploy/scripts/install.sh.
if [ -f "$DEPLOY_DIR/../../manifest.json" ]; then
  # Inside a package: deploy is at <pkg>/source/deploy, package root is two levels up
  PACKAGE_ROOT="$(cd "$DEPLOY_DIR/../.." && pwd)"
else
  # Inside the repo: deploy is at <repo>/deploy, repo root is one level up
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

print_install_guide() {
  local tool="$1"
  echo ""
  case "$tool" in
    docker)
      log "Docker + Docker Compose v2 is required."
      case "$PLATFORM" in
        linux)
          echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | sh"
          echo "  Then: sudo usermod -aG docker \$USER && newgrp docker" ;;
        macos)
          echo "  Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
          echo "  Or: brew install --cask docker" ;;
        windows)
          echo "  Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
          echo "  Enable WSL 2 backend in Docker Desktop settings." ;;
      esac ;;
    node)
      log "Node.js 22+ is required."
      case "$PLATFORM" in
        linux)
          echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
          echo "  sudo apt-get install -y nodejs"
          echo "  Or: https://nodejs.org/en/download/" ;;
        macos)
          echo "  brew install node@22"
          echo "  Or: https://nodejs.org/en/download/" ;;
        windows)
          echo "  https://nodejs.org/en/download/"
          echo "  Or: winget install OpenJS.NodeJS" ;;
      esac ;;
    pnpm)
      log "pnpm is required for building from source."
      echo "  npm install -g pnpm"
      echo "  Or: corepack enable && corepack prepare pnpm --activate" ;;
  esac
  echo ""
}

check_dependencies() {
  local mode="$1"
  local missing=0

  if [ "$mode" = "docker" ]; then
    if ! check_docker; then
      print_install_guide docker
      missing=1
    fi
  elif [ "$mode" = "bare-metal" ]; then
    if ! check_node; then
      print_install_guide node
      missing=1
    fi
    if ! check_pnpm; then
      print_install_guide pnpm
      missing=1
    fi
  fi

  if [ "$missing" -eq 1 ]; then
    err "Missing dependencies. Install them and re-run."
  fi
}

ensure_pm2() {
  if ! check_pm2; then
    log "Installing PM2 globally..."
    npm install -g pm2
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
      log "Created .env from .env.example"
    else
      err ".env.example not found. Cannot initialize environment."
    fi
  fi

  # Auto-generate token if empty
  # shellcheck disable=SC1090
  source "$env_file"
  if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    local token
    token=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
    if grep -q "^OPENCLAW_GATEWAY_TOKEN=" "$env_file"; then
      sed -i.bak "s/^OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$token/" "$env_file" && rm -f "$env_file.bak"
    else
      echo "OPENCLAW_GATEWAY_TOKEN=$token" >> "$env_file"
    fi
    log "Generated gateway token"
    # Re-source after modification
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
  check_dependencies docker
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
    # Run seed.js inside the gateway container, mounting state dir and seed script
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
  log "  cd $DEPLOY_DIR/docker"
  log "  docker compose --env-file ../.env ps       # Status"
  log "  docker compose --env-file ../.env logs -f   # Logs"
  log "  docker compose --env-file ../.env restart   # Restart"
  log "  docker compose --env-file ../.env down      # Stop"
}

# ---------------------------------------------------------------------------
# Bare-metal install (PM2)
# ---------------------------------------------------------------------------
bare_metal_install() {
  check_dependencies bare-metal
  ensure_env
  ensure_pm2

  local source_dir="$PACKAGE_ROOT"
  [ -d "$PACKAGE_ROOT/source" ] && source_dir="$PACKAGE_ROOT/source"
  cd "$source_dir"

  # Build (skip if pre-built)
  if [ ! -f dist/cli-startup-metadata.json ]; then
    log "Installing dependencies..."
    pnpm install --frozen-lockfile
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

  # Seed
  local state_dir="${OPENCLAW_STATE_DIR:-$DEPLOY_DIR/data/.openclaw}"
  mkdir -p "$state_dir"
  node "$SCRIPT_DIR/seed.js" "$state_dir"

  # Generate PM2 config
  node "$SCRIPT_DIR/generate-ecosystem.js" "$source_dir"

  # Start
  pm2 start "$DEPLOY_DIR/ecosystem.config.cjs"
  pm2 save

  echo ""
  log "=== Installation complete ==="
  log "Gateway: http://localhost:${GATEWAY_PORT:-18789}"
  log "Deck:    http://localhost:${DECK_PORT:-3000}"
  log ""
  log "Manage with:"
  log "  pm2 status                    # Status"
  log "  pm2 logs                      # Logs"
  log "  pm2 restart all               # Restart"
  log "  pm2 stop all                  # Stop"
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
    echo "  1) Docker       — (Docker not detected)"
  fi
  echo ""
  if check_node 2>/dev/null; then
    echo "  2) Bare-metal   — Runs natively with PM2 process manager."
    echo "                     Requires: Node.js 22+, pnpm"
  else
    echo "  2) Bare-metal   — (Node.js 22+ not detected)"
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
