#!/usr/bin/env bash
# stop.sh — Stop OpenClaw Gateway + Deck services.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

MODE="${1:-auto}"
case "$MODE" in
  docker)  ;;
  pm2)     ;;
  auto)
    if command -v pm2 >/dev/null 2>&1 && pm2 describe openclaw-gateway >/dev/null 2>&1; then
      MODE=pm2
    elif command -v docker >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/docker/docker-compose.yml" ]; then
      MODE=docker
    else
      echo "[stop] No running services detected."
      exit 0
    fi
    ;;
  *)
    echo "Usage: $0 [docker|pm2|auto]"
    exit 1
    ;;
esac

echo "[stop] Stopping services (mode: $MODE)..."

if [ "$MODE" = "docker" ]; then
  cd "$SCRIPT_DIR/docker"
  docker compose --env-file "$SCRIPT_DIR/.env" down
elif [ "$MODE" = "pm2" ]; then
  pm2 delete openclaw-gateway openclaw-deck 2>/dev/null || pm2 delete all 2>/dev/null || true
  pm2 save --force
fi

echo "[stop] Services stopped."
