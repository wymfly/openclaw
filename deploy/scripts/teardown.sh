#!/usr/bin/env bash
#
# teardown.sh — Remove OpenClaw deployment.
#
# Usage:
#   deploy/scripts/teardown.sh docker      # Remove Docker containers + images
#   deploy/scripts/teardown.sh bare-metal   # Remove PM2 processes
#   deploy/scripts/teardown.sh all          # Remove everything including data
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() { echo "[teardown] $*"; }

case "${1:-}" in
  docker)
    cd "$DEPLOY_DIR/docker"
    docker compose --env-file "$DEPLOY_DIR/.env" down --rmi local --volumes 2>/dev/null || true
    docker compose --env-file "$DEPLOY_DIR/.env" -f docker-compose.yml -f docker-compose.sandbox.yml down --rmi local --volumes 2>/dev/null || true
    log "Docker resources removed."
    ;;
  bare-metal)
    pm2 stop openclaw-gateway openclaw-deck 2>/dev/null || true
    pm2 delete openclaw-gateway openclaw-deck 2>/dev/null || true
    pm2 save --force 2>/dev/null || true
    log "PM2 processes removed."
    ;;
  all)
    "$0" docker
    "$0" bare-metal
    log "Removing data directories..."
    rm -rf "$DEPLOY_DIR/data"
    log "All data removed."
    ;;
  *)
    echo "Usage: $0 [docker | bare-metal | all]"
    exit 1
    ;;
esac
