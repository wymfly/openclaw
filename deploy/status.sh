#!/usr/bin/env bash
# status.sh — Show OpenClaw Gateway + Deck service status.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

GW_PORT="${GATEWAY_PORT:-18789}"
DK_PORT="${DECK_PORT:-3000}"

echo "╔══════════════════════════════════════════════╗"
echo "║        OpenClaw Service Status               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# --- Process status ---
echo "=== Process Status ==="

# Check PM2
if command -v pm2 >/dev/null 2>&1 && pm2 describe openclaw-gateway >/dev/null 2>&1; then
  echo "[PM2 mode]"
  pm2 status
  echo ""
fi

# Check Docker
if command -v docker >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/docker/docker-compose.yml" ]; then
  cd "$SCRIPT_DIR/docker"
  if docker compose --env-file "$SCRIPT_DIR/.env" ps --status running 2>/dev/null | grep -q "openclaw"; then
    echo "[Docker mode]"
    docker compose --env-file "$SCRIPT_DIR/.env" ps
    echo ""
  fi
fi

# --- Health probes ---
echo "=== Health Probes ==="

# Gateway
if curl -sf "http://localhost:$GW_PORT/healthz" >/dev/null 2>&1; then
  echo "  Gateway  (:$GW_PORT)  ✓ healthy"
else
  echo "  Gateway  (:$GW_PORT)  ✗ unreachable"
fi

# Deck
if curl -sf "http://localhost:$DK_PORT" >/dev/null 2>&1; then
  echo "  Deck     (:$DK_PORT)  ✓ healthy"
else
  echo "  Deck     (:$DK_PORT)  ✗ unreachable"
fi

echo ""

# --- Data directories ---
STATE_DIR="${OPENCLAW_STATE_DIR:-$SCRIPT_DIR/data/.openclaw}"
DECK_DATA="${DECK_DATA_DIR:-$SCRIPT_DIR/data/openclaw-deck}"

echo "=== Data Directories ==="
if [ -d "$STATE_DIR" ]; then
  echo "  Gateway state: $STATE_DIR"
  [ -f "$STATE_DIR/openclaw.json" ] && echo "    config: OK" || echo "    config: MISSING"
else
  echo "  Gateway state: NOT FOUND ($STATE_DIR)"
fi
if [ -d "$DECK_DATA" ]; then
  echo "  Deck data:     $DECK_DATA"
  ls "$DECK_DATA"/*.json >/dev/null 2>&1 && echo "    data files: OK" || echo "    data files: EMPTY (will be created on first run)"
else
  echo "  Deck data:     NOT FOUND ($DECK_DATA)"
fi

echo ""
echo "=== Endpoints ==="
echo "  Gateway: http://localhost:$GW_PORT"
echo "  Deck:    http://localhost:$DK_PORT"
