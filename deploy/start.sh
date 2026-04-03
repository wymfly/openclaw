#!/usr/bin/env bash
# start.sh — Start OpenClaw Gateway + Deck services.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# Detect mode
if [ -f "$SCRIPT_DIR/docker/docker-compose.yml" ] && command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  HAS_DOCKER=true
else
  HAS_DOCKER=false
fi
HAS_PM2=false
command -v pm2 >/dev/null 2>&1 && HAS_PM2=true

MODE="${1:-auto}"
case "$MODE" in
  docker)  ;;
  pm2)     ;;
  auto)
    if [ "$HAS_PM2" = true ] && [ -f "$SCRIPT_DIR/ecosystem.config.cjs" ]; then
      MODE=pm2
    elif [ "$HAS_DOCKER" = true ]; then
      MODE=docker
    else
      echo "[start] ERROR: Neither PM2 config nor Docker found. Run install.sh first."
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 [docker|pm2|auto]"
    exit 1
    ;;
esac

echo "[start] Starting services (mode: $MODE)..."

if [ "$MODE" = "docker" ]; then
  cd "$SCRIPT_DIR/docker"
  docker compose --env-file "$SCRIPT_DIR/.env" up -d
  sleep 3
  docker compose --env-file "$SCRIPT_DIR/.env" ps
elif [ "$MODE" = "pm2" ]; then
  if [ ! -f "$SCRIPT_DIR/ecosystem.config.cjs" ]; then
    echo "[start] ERROR: ecosystem.config.cjs not found. Run install.sh first."
    exit 1
  fi
  pm2 start "$SCRIPT_DIR/ecosystem.config.cjs"
  pm2 save
  pm2 status
fi

echo ""
echo "[start] Gateway: http://localhost:${GATEWAY_PORT:-18789}"
echo "[start] Deck:    http://localhost:${DECK_PORT:-3000}"
