#!/usr/bin/env bash
#
# package.sh — Build and package OpenClaw + Deck for deployment on another machine.
#
# Usage:
#   deploy/scripts/package.sh                    # Docker + bare-metal package
#   deploy/scripts/package.sh --docker-only      # Docker images only (smaller)
#   deploy/scripts/package.sh --source-only      # Source package only (no Docker)
#   deploy/scripts/package.sh --with-local       # Include runtime plugins + skills from ~/.openclaw
#   deploy/scripts/package.sh --output /path     # Custom output directory
#
# Output:
#   openclaw-deploy-YYYYMMDD-HHMMSS.tar.gz
#
# The package contains everything needed to deploy on a fresh machine:
#   - Pre-built Docker images (docker load ready)
#   - Source code for bare-metal builds
#   - Deploy scripts, configs, seed data
#   - Self-contained install script
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

# Parse args
DOCKER_ONLY=false
SOURCE_ONLY=false
WITH_LOCAL=false
OUTPUT_DIR="$DEPLOY_DIR"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker-only)  DOCKER_ONLY=true; shift ;;
    --source-only)  SOURCE_ONLY=true; shift ;;
    --with-local)   WITH_LOCAL=true; shift ;;
    --output)       OUTPUT_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--docker-only|--source-only] [--with-local] [--output /path]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
PACKAGE_NAME="openclaw-deploy-${TIMESTAMP}"
STAGING_DIR="/tmp/${PACKAGE_NAME}"

log() { echo "[package] $*"; }
err() { echo "[package] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Cleanup on exit
# ---------------------------------------------------------------------------
cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Stage deploy scripts and configs
# ---------------------------------------------------------------------------
stage_deploy() {
  log "Staging deploy scripts and configs..."
  mkdir -p "$STAGING_DIR/deploy"

  # Copy deploy directory (excluding data and .env)
  rsync -a --exclude='data' --exclude='.env' --exclude='*.tar' --exclude='*.tar.gz' \
    "$DEPLOY_DIR/" "$STAGING_DIR/deploy/"

  log "Deploy scripts staged"
}

# ---------------------------------------------------------------------------
# Build and export Docker images
# ---------------------------------------------------------------------------
stage_docker() {
  log "Building Docker images..."
  cd "$REPO_DIR"

  # Build Gateway image
  log "Building Gateway image..."
  NO_PROXY=localhost,127.0.0.1 docker build \
    -f Dockerfile \
    --build-arg OPENCLAW_DOCKER_APT_PACKAGES="python3 python3-pip ripgrep jq wget" \
    -t openclaw-gateway:package \
    . 2>&1 | tail -5

  # Build Deck image
  log "Building Deck image..."
  NO_PROXY=localhost,127.0.0.1 docker build \
    -f deploy/Dockerfile.deck \
    -t openclaw-deck:package \
    . 2>&1 | tail -5

  # Export images
  mkdir -p "$STAGING_DIR/images"

  log "Exporting Gateway image..."
  docker save openclaw-gateway:package | gzip > "$STAGING_DIR/images/gateway.tar.gz"
  local gw_size
  gw_size=$(du -h "$STAGING_DIR/images/gateway.tar.gz" | cut -f1)
  log "Gateway image: $gw_size"

  log "Exporting Deck image..."
  docker save openclaw-deck:package | gzip > "$STAGING_DIR/images/deck.tar.gz"
  local deck_size
  deck_size=$(du -h "$STAGING_DIR/images/deck.tar.gz" | cut -f1)
  log "Deck image: $deck_size"

  # Also build sandbox images if Dockerfile.sandbox exists
  if [ -f "$REPO_DIR/Dockerfile.sandbox" ]; then
    log "Building Sandbox base image..."
    NO_PROXY=localhost,127.0.0.1 docker build \
      -f Dockerfile.sandbox \
      -t openclaw-sandbox:bookworm-slim \
      . 2>&1 | tail -3

    if [ -f "$REPO_DIR/Dockerfile.sandbox-common" ]; then
      log "Building Sandbox common image..."
      NO_PROXY=localhost,127.0.0.1 docker build \
        -f Dockerfile.sandbox-common \
        --build-arg BASE_IMAGE=openclaw-sandbox:bookworm-slim \
        -t openclaw-sandbox:common \
        . 2>&1 | tail -3
    fi

    log "Exporting Sandbox images..."
    docker save openclaw-sandbox:bookworm-slim openclaw-sandbox:common 2>/dev/null \
      | gzip > "$STAGING_DIR/images/sandbox.tar.gz" || true
    if [ -f "$STAGING_DIR/images/sandbox.tar.gz" ]; then
      local sb_size
      sb_size=$(du -h "$STAGING_DIR/images/sandbox.tar.gz" | cut -f1)
      log "Sandbox images: $sb_size"
    fi
  fi

  # Create docker-compose that uses local images (not build)
  cat > "$STAGING_DIR/deploy/docker-compose.package.yml" <<'COMPOSE'
# Docker Compose for pre-built package deployment.
# Uses locally loaded images instead of building from source.

services:
  gateway:
    image: openclaw-gateway:package
    ports:
      - "${GATEWAY_PORT:-18789}:18789"
      - "${DECK_PORT:-3000}:3000"
    volumes:
      - ${OPENCLAW_STATE_DIR:-./data/gateway}:/home/node/.openclaw
    environment:
      HOME: /home/node
      TERM: xterm-256color
      OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      TZ: ${TZ:-Asia/Shanghai}
    command:
      [
        "node", "openclaw.mjs", "gateway", "run",
        "--bind", "lan",
        "--port", "18789",
        "--force",
      ]
    healthcheck:
      test:
        [
          "CMD", "node", "-e",
          "fetch('http://127.0.0.1:18789/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    init: true
    restart: unless-stopped

  deck:
    image: openclaw-deck:package
    network_mode: "service:gateway"
    volumes:
      - ${DECK_DATA_DIR:-./data/deck}:/data
    environment:
      DECK_GATEWAY_URL: ws://localhost:18789
      DECK_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      DECK_DB_PATH: /data/deck.db
    depends_on:
      gateway:
        condition: service_healthy
    init: true
    restart: unless-stopped
COMPOSE

  # Sandbox overlay for package mode
  cat > "$STAGING_DIR/deploy/docker-compose.package.sandbox.yml" <<'COMPOSE'
services:
  gateway:
    volumes:
      - ${DOCKER_SOCKET:-/var/run/docker.sock}:/var/run/docker.sock
    group_add:
      - "${DOCKER_GID:-999}"
COMPOSE

  log "Docker images staged"
}

# ---------------------------------------------------------------------------
# Stage source code for bare-metal
# ---------------------------------------------------------------------------
stage_source() {
  log "Staging source code for bare-metal deployment..."
  mkdir -p "$STAGING_DIR/source"

  cd "$REPO_DIR"
  rsync -a \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='deploy/data' \
    --exclude='deploy/.env' \
    --exclude='*.png' \
    --exclude='*.tar.gz' \
    --exclude='test-results' \
    --exclude='test-screenshots' \
    --exclude='.playwright-mcp' \
    --exclude='e2e-test-agent' \
    --exclude='new-agent' \
    --exclude='test-agent' \
    --exclude='console-debug.log' \
    --exclude='console-errors.log' \
    --exclude='test-server.log' \
    "$REPO_DIR/" "$STAGING_DIR/source/"

  log "Source code staged"
}

# ---------------------------------------------------------------------------
# Collect local runtime plugins and skills from ~/.openclaw
# ---------------------------------------------------------------------------
stage_local() {
  local state_dir="${HOME}/.openclaw"
  if [ ! -d "$state_dir" ]; then
    log "WARN: ~/.openclaw not found, skipping local collection"
    return
  fi

  local seed_dir="$STAGING_DIR/deploy/seed"

  # 1. Runtime-installed extensions (e.g. openclaw-weixin)
  if [ -d "$state_dir/extensions" ]; then
    local ext_count=0
    for ext_dir in "$state_dir/extensions"/*/; do
      [ -d "$ext_dir" ] || continue
      local ext_name
      ext_name="$(basename "$ext_dir")"
      # Skip backup dirs and hidden dirs
      [[ "$ext_name" == .* ]] && continue

      mkdir -p "$seed_dir/extensions/$ext_name"
      rsync -a \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        "$ext_dir" "$seed_dir/extensions/$ext_name/"
      log "collected extension: $ext_name"
      ext_count=$((ext_count + 1))
    done
    log "Total extensions collected: $ext_count"
  fi

  # 2. Custom skills from agents' workspace
  #    Look in common locations where users might put custom skills
  local skills_collected=0

  # Check ~/.openclaw/skills/ (if user has a local skills dir)
  if [ -d "$state_dir/skills" ]; then
    for skill_dir in "$state_dir/skills"/*/; do
      [ -d "$skill_dir" ] || continue
      local skill_name
      skill_name="$(basename "$skill_dir")"
      mkdir -p "$seed_dir/skills/$skill_name"
      cp -a "$skill_dir"* "$seed_dir/skills/$skill_name/" 2>/dev/null || true
      log "collected skill: $skill_name (from ~/.openclaw/skills/)"
      skills_collected=$((skills_collected + 1))
    done
  fi

  # 3. Plugins config from openclaw.json (extract plugins.entries section)
  if [ -f "$state_dir/openclaw.json" ]; then
    python3 -c "
import json, sys
with open('$state_dir/openclaw.json') as f:
    cfg = json.load(f)
plugins = cfg.get('plugins', {})
if plugins:
    print(json.dumps(plugins, indent=2))
    sys.exit(0)
sys.exit(1)
" > "$seed_dir/plugins-config.json" 2>/dev/null || true

    if [ -f "$seed_dir/plugins-config.json" ] && [ -s "$seed_dir/plugins-config.json" ]; then
      log "collected plugins config"
    else
      rm -f "$seed_dir/plugins-config.json"
    fi
  fi

  log "Local content collection complete (extensions: $ext_count, skills: $skills_collected)"
}

# ---------------------------------------------------------------------------
# Create top-level install script
# ---------------------------------------------------------------------------
create_installer() {
  cat > "$STAGING_DIR/install.sh" <<'INSTALLER'
#!/usr/bin/env bash
#
# OpenClaw + Deck Deployment Installer
#
# This package was created by deploy/scripts/package.sh.
# Run this script on the target machine to deploy.
#
# Usage:
#   ./install.sh                          # Interactive
#   ./install.sh docker                   # Docker mode (pre-built images)
#   ./install.sh docker --sandbox         # Docker + Sandbox
#   ./install.sh bare-metal               # Bare-metal mode (build from source)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { echo "[install] $*"; }
err() { echo "[install] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Docker install
# ---------------------------------------------------------------------------
docker_install() {
  local sandbox="${1:-}"

  command -v docker >/dev/null || err "docker not found"
  docker compose version >/dev/null 2>&1 || err "docker compose v2 not found"

  # Load pre-built images
  if [ -d "$SCRIPT_DIR/images" ]; then
    log "Loading Docker images..."
    for img in "$SCRIPT_DIR/images"/*.tar.gz; do
      [ -f "$img" ] || continue
      log "  Loading $(basename "$img")..."
      docker load < "$img"
    done
    log "Images loaded"
  else
    err "No images directory found. Was this package built with --source-only?"
  fi

  # Set up deploy directory
  local deploy_dir="$SCRIPT_DIR/deploy"
  cd "$deploy_dir"

  # Create .env if needed
  if [ ! -f .env ]; then
    cp .env.example .env
    log ""
    log "========================================="
    log "  IMPORTANT: Edit .env before continuing"
    log "========================================="
    log ""
    log "  File: $deploy_dir/.env"
    log "  Set at least one API key (DEEPSEEK_API_KEY, etc.)"
    log ""
    log "  Then re-run: $0 docker${sandbox:+ $sandbox}"
    exit 0
  fi

  # Source .env
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a

  # Auto-generate token if empty
  if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
    sed -i "s/^OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN/" .env 2>/dev/null \
      || sed -i '' "s/^OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN/" .env
    export OPENCLAW_GATEWAY_TOKEN
    log "Auto-generated gateway token"
  fi

  export DEFAULT_MODEL="${DEFAULT_MODEL:-deepseek/deepseek-chat}"

  # Seed data
  local state_dir="${OPENCLAW_STATE_DIR:-./data/gateway}"
  mkdir -p "$state_dir"
  ./scripts/seed.sh "$state_dir"

  # Start with package compose (uses pre-built images)
  if [ "$sandbox" = "--sandbox" ]; then
    # Load sandbox images if available
    if [ -f "$SCRIPT_DIR/images/sandbox.tar.gz" ]; then
      log "Loading sandbox images..."
      docker load < "$SCRIPT_DIR/images/sandbox.tar.gz"
    fi
    docker compose -f docker-compose.package.yml -f docker-compose.package.sandbox.yml up -d
  else
    docker compose -f docker-compose.package.yml up -d
  fi

  log "Waiting for services..."
  sleep 8

  # Status
  docker compose -f docker-compose.package.yml ps
  echo ""

  local gw_ok=false deck_ok=false
  curl -sf "http://localhost:${GATEWAY_PORT:-18789}/healthz" >/dev/null 2>&1 && gw_ok=true
  curl -sf "http://localhost:${DECK_PORT:-3000}" >/dev/null 2>&1 && deck_ok=true

  log "Gateway: $( [ "$gw_ok" = true ] && echo "healthy" || echo "starting..." )"
  log "Deck:    $( [ "$deck_ok" = true ] && echo "healthy" || echo "starting..." )"

  echo ""
  log "========================================="
  log "  OpenClaw + Deck deployed successfully"
  log "========================================="
  log ""
  log "  Deck:    http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost):${DECK_PORT:-3000}"
  log "  Gateway: http://localhost:${GATEWAY_PORT:-18789}"
  log ""
  log "  Manage:"
  log "    cd $deploy_dir"
  log "    docker compose -f docker-compose.package.yml logs -f"
  log "    docker compose -f docker-compose.package.yml restart"
  log "    docker compose -f docker-compose.package.yml down"
  log ""
}

# ---------------------------------------------------------------------------
# Bare-metal install
# ---------------------------------------------------------------------------
bare_metal_install() {
  if [ ! -d "$SCRIPT_DIR/source" ]; then
    err "No source directory found. Was this package built with --docker-only?"
  fi

  # Use the source tree's bare-metal installer
  cd "$SCRIPT_DIR/source"
  export OPENCLAW_INSTALL_DIR="${OPENCLAW_INSTALL_DIR:-/opt/openclaw}"

  # Copy deploy .env if exists
  if [ -f "$SCRIPT_DIR/deploy/.env" ]; then
    mkdir -p deploy
    cp "$SCRIPT_DIR/deploy/.env" deploy/.env
  fi

  exec deploy/bare-metal/install.sh
}

# ---------------------------------------------------------------------------
# Interactive
# ---------------------------------------------------------------------------
detect_and_run() {
  local has_docker=false
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && has_docker=true

  local has_images=false
  [ -d "$SCRIPT_DIR/images" ] && has_images=true

  local has_source=false
  [ -d "$SCRIPT_DIR/source" ] && has_source=true

  echo ""
  echo "OpenClaw + Deck Deployment Package"
  echo "==================================="
  echo ""
  echo "Available modes:"
  [ "$has_docker" = true ] && [ "$has_images" = true ] && echo "  1) docker          — Deploy using pre-built Docker images (recommended)"
  [ "$has_docker" = true ] && [ "$has_images" = true ] && echo "  2) docker --sandbox — Docker + agent execution isolation"
  [ "$has_source" = true ] && echo "  3) bare-metal      — Build from source + systemd"
  echo ""

  read -rp "Select mode [1]: " choice
  case "${choice:-1}" in
    1) docker_install ;;
    2) docker_install --sandbox ;;
    3) bare_metal_install ;;
    *) err "Invalid choice" ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
case "${1:-}" in
  docker)      docker_install "${2:-}" ;;
  bare-metal)  bare_metal_install ;;
  "")          detect_and_run ;;
  *)           echo "Usage: $0 [docker [--sandbox] | bare-metal]"; exit 1 ;;
esac
INSTALLER

  chmod +x "$STAGING_DIR/install.sh"
  log "Installer script created"
}

# ---------------------------------------------------------------------------
# Create README
# ---------------------------------------------------------------------------
create_readme() {
  cat > "$STAGING_DIR/README.txt" <<README
OpenClaw + Deck Deployment Package
===================================

Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Source:   $(cd "$REPO_DIR" && git describe --always --dirty 2>/dev/null || echo "unknown")
Branch:   $(cd "$REPO_DIR" && git branch --show-current 2>/dev/null || echo "unknown")

Quick Start (Docker)
--------------------
1. Transfer this package to the target machine
2. Extract: tar xzf ${PACKAGE_NAME}.tar.gz
3. cd ${PACKAGE_NAME}
4. ./install.sh docker
5. Edit deploy/.env with your API keys
6. ./install.sh docker (again)
7. Open http://<host>:3000

Quick Start (Bare-metal)
------------------------
1. Transfer this package to the target machine
2. Extract: tar xzf ${PACKAGE_NAME}.tar.gz
3. cd ${PACKAGE_NAME}
4. Edit deploy/.env with your API keys
5. sudo ./install.sh bare-metal

Package Contents
----------------
README

  [ -d "$STAGING_DIR/images" ] && echo "images/        — Pre-built Docker images" >> "$STAGING_DIR/README.txt"
  [ -d "$STAGING_DIR/source" ] && echo "source/        — Source code for bare-metal builds" >> "$STAGING_DIR/README.txt"
  cat >> "$STAGING_DIR/README.txt" <<README
deploy/        — Deploy scripts, configs, seed data
install.sh     — Self-contained installer

For detailed documentation, see deploy/README.md
README
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

log "=== OpenClaw + Deck Packaging ==="
log "Repo: $REPO_DIR"
log "Output: $OUTPUT_DIR"
log ""

mkdir -p "$STAGING_DIR"

# Always stage deploy scripts
stage_deploy

# Docker images
if [ "$SOURCE_ONLY" = false ]; then
  stage_docker
fi

# Source code
if [ "$DOCKER_ONLY" = false ]; then
  stage_source
fi

# Local runtime plugins and skills
if [ "$WITH_LOCAL" = true ]; then
  stage_local
fi

# Create installer and readme
create_installer
create_readme

# Create tarball
log ""
log "Creating package..."
cd /tmp
tar czf "$OUTPUT_DIR/${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"

FINAL_SIZE=$(du -h "$OUTPUT_DIR/${PACKAGE_NAME}.tar.gz" | cut -f1)

log ""
log "=== Package Complete ==="
log ""
log "  File: $OUTPUT_DIR/${PACKAGE_NAME}.tar.gz"
log "  Size: $FINAL_SIZE"
log ""
log "  Transfer to target machine and run:"
log "    tar xzf ${PACKAGE_NAME}.tar.gz"
log "    cd ${PACKAGE_NAME}"
log "    ./install.sh"
log ""
