#!/usr/bin/env bash
#
# setup.sh — Unified deployment entry point for OpenClaw + Deck.
#
# Usage:
#   deploy/scripts/setup.sh                   # interactive mode detection
#   deploy/scripts/setup.sh docker             # Docker mode
#   deploy/scripts/setup.sh docker --sandbox   # Docker + sandbox
#   deploy/scripts/setup.sh bare-metal         # Bare-metal mode
#   deploy/scripts/setup.sh stop               # Stop services
#   deploy/scripts/setup.sh status             # Show status
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

log() { echo "[setup] $*"; }
err() { echo "[setup] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# .env management
# ---------------------------------------------------------------------------

ensure_env() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"
    log "Created $ENV_FILE from template."
    log "Please edit $ENV_FILE and set your API keys, then re-run."
    exit 0
  fi

  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a

  if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
    if grep -q '^OPENCLAW_GATEWAY_TOKEN=' "$ENV_FILE"; then
      sed -i.bak "s/^OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN/" "$ENV_FILE"
      rm -f "$ENV_FILE.bak"
    else
      echo "OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN" >> "$ENV_FILE"
    fi
    export OPENCLAW_GATEWAY_TOKEN
    log "Auto-generated gateway token: ${OPENCLAW_GATEWAY_TOKEN:0:8}..."
  fi

  export DEFAULT_MODEL="${DEFAULT_MODEL:-deepseek/deepseek-chat}"
}

# ---------------------------------------------------------------------------
# Docker mode
# ---------------------------------------------------------------------------

docker_up() {
  local sandbox="${1:-}"

  log "Checking Docker..."
  command -v docker >/dev/null || err "docker not found"
  docker compose version >/dev/null 2>&1 || err "docker compose v2 not found"

  ensure_env

  local state_dir="${OPENCLAW_STATE_DIR:-$DEPLOY_DIR/data/gateway}"
  mkdir -p "$state_dir"
  "$SCRIPT_DIR/seed.sh" "$state_dir"

  cd "$DEPLOY_DIR"

  if [ "$sandbox" = "--sandbox" ]; then
    log "Building sandbox images..."
    cd "$REPO_DIR"
    docker build -f Dockerfile.sandbox -t openclaw-sandbox:bookworm-slim . 2>/dev/null || log "WARN: sandbox base build failed"
    docker build -f Dockerfile.sandbox-common \
      --build-arg BASE_IMAGE=openclaw-sandbox:bookworm-slim \
      -t openclaw-sandbox:common . 2>/dev/null || log "WARN: sandbox common build failed"
    cd "$DEPLOY_DIR"

    log "Starting with sandbox..."
    docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d --build
  else
    log "Starting..."
    docker compose up -d --build
  fi

  log "Waiting for services..."
  sleep 5

  docker_status
}

docker_down() {
  cd "$DEPLOY_DIR"
  if [ -f docker-compose.sandbox.yml ] && docker compose -f docker-compose.yml -f docker-compose.sandbox.yml ps --quiet 2>/dev/null | grep -q .; then
    docker compose -f docker-compose.yml -f docker-compose.sandbox.yml down
  else
    docker compose down 2>/dev/null || true
  fi
  log "Services stopped."
}

docker_status() {
  cd "$DEPLOY_DIR"
  echo ""
  docker compose ps 2>/dev/null || true
  echo ""

  local gw_ok=false deck_ok=false
  curl -sf "http://localhost:${GATEWAY_PORT:-18789}/healthz" >/dev/null 2>&1 && gw_ok=true
  curl -sf "http://localhost:${DECK_PORT:-3000}" >/dev/null 2>&1 && deck_ok=true

  log "Gateway: $( [ "$gw_ok" = true ] && echo "healthy" || echo "unreachable" )"
  log "Deck:    $( [ "$deck_ok" = true ] && echo "healthy" || echo "unreachable" )"

  if [ "$deck_ok" = true ]; then
    echo ""
    log "Access Deck at: http://localhost:${DECK_PORT:-3000}"
  fi
}

# ---------------------------------------------------------------------------
# Bare-metal mode
# ---------------------------------------------------------------------------

bare_metal_up() {
  ensure_env
  log "Launching bare-metal installer..."
  exec sudo -E "$DEPLOY_DIR/bare-metal/install.sh"
}

bare_metal_status() {
  systemctl status openclaw-gateway --no-pager 2>/dev/null || log "Gateway service not found"
  echo ""
  systemctl status openclaw-deck --no-pager 2>/dev/null || log "Deck service not found"
}

bare_metal_down() {
  sudo systemctl stop openclaw-deck openclaw-gateway 2>/dev/null || true
  log "Services stopped."
}

# ---------------------------------------------------------------------------
# Interactive mode detection
# ---------------------------------------------------------------------------

detect_mode() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log "Docker detected. Use 'docker' or 'bare-metal'?"
    read -rp "[docker/bare-metal] (default: docker): " mode
    mode="${mode:-docker}"
  else
    log "Docker not found, defaulting to bare-metal."
    mode="bare-metal"
  fi
  echo "$mode"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-}" in
  docker)
    docker_up "${2:-}"
    ;;
  bare-metal)
    bare_metal_up
    ;;
  stop)
    if systemctl is-active openclaw-gateway >/dev/null 2>&1; then
      bare_metal_down
    else
      docker_down
    fi
    ;;
  status)
    if systemctl is-active openclaw-gateway >/dev/null 2>&1; then
      bare_metal_status
    else
      docker_status
    fi
    ;;
  "")
    mode=$(detect_mode)
    case "$mode" in
      docker)     docker_up ;;
      bare-metal) bare_metal_up ;;
      *)          err "Unknown mode: $mode" ;;
    esac
    ;;
  *)
    echo "Usage: $0 [docker [--sandbox] | bare-metal | stop | status]"
    exit 1
    ;;
esac
