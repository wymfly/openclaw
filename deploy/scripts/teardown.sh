#!/usr/bin/env bash
#
# teardown.sh — Remove OpenClaw deployment.
#
# Usage:
#   deploy/scripts/teardown.sh docker      # Remove Docker containers + images
#   deploy/scripts/teardown.sh bare-metal   # Remove systemd services
#   deploy/scripts/teardown.sh all          # Remove everything including data
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() { echo "[teardown] $*"; }

case "${1:-}" in
  docker)
    cd "$DEPLOY_DIR"
    docker compose down --rmi local --volumes 2>/dev/null || true
    docker compose -f docker-compose.yml -f docker-compose.sandbox.yml down --rmi local --volumes 2>/dev/null || true
    log "Docker resources removed."
    ;;
  bare-metal)
    sudo systemctl stop openclaw-deck openclaw-gateway 2>/dev/null || true
    sudo systemctl disable openclaw-deck openclaw-gateway 2>/dev/null || true
    sudo rm -f /etc/systemd/system/openclaw-gateway.service /etc/systemd/system/openclaw-deck.service
    sudo systemctl daemon-reload
    log "systemd services removed."
    ;;
  all)
    "$0" docker
    "$0" bare-metal
    log "Removing data directories..."
    rm -rf "$DEPLOY_DIR/data"
    sudo rm -rf /var/lib/openclaw /var/lib/openclaw-deck /etc/openclaw 2>/dev/null || true
    log "All data removed."
    ;;
  *)
    echo "Usage: $0 [docker | bare-metal | all]"
    exit 1
    ;;
esac
