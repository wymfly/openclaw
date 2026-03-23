#!/usr/bin/env bash
#
# deck-dev.sh — Start Gateway (from local source) + Dashboard dev server
#
# Usage:
#   scripts/dev/deck-dev.sh          # start both
#   scripts/dev/deck-dev.sh gateway  # start Gateway only
#   scripts/dev/deck-dev.sh deck     # start Dashboard only
#   scripts/dev/deck-dev.sh stop     # stop both
#
# Why local source: This is an enhanced fork. The global `openclaw` installation
# does NOT include our custom RPC handlers (Channel Event Filter, etc.).
# Always use `pnpm openclaw gateway run` to run from the local source tree.

set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

export NO_PROXY=localhost,127.0.0.1

GATEWAY_PORT=18789
DECK_PORT=3000
GATEWAY_LOG=/tmp/openclaw-gateway-dev.log
DECK_LOG=/tmp/deck-dev.log

stop_gateway() {
  local pid
  pid=$(lsof -ti :$GATEWAY_PORT 2>/dev/null | head -1) || true
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    echo "[deck-dev] Gateway (pid $pid) stopped"
  else
    echo "[deck-dev] Gateway not running"
  fi
}

stop_deck() {
  local pid
  pid=$(lsof -ti :$DECK_PORT -sTCP:LISTEN 2>/dev/null | head -1) || true
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    echo "[deck-dev] Dashboard (pid $pid) stopped"
  else
    echo "[deck-dev] Dashboard not running"
  fi
}

start_gateway() {
  stop_gateway
  echo "[deck-dev] Starting Gateway from LOCAL SOURCE on :$GATEWAY_PORT ..."
  nohup pnpm openclaw gateway run --bind loopback --port $GATEWAY_PORT --force \
    > "$GATEWAY_LOG" 2>&1 &
  # Wait for listen
  for i in $(seq 1 30); do
    if lsof -i :$GATEWAY_PORT -sTCP:LISTEN &>/dev/null; then
      echo "[deck-dev] Gateway ready (pid $(lsof -ti :$GATEWAY_PORT -sTCP:LISTEN | head -1))"
      return 0
    fi
    sleep 1
  done
  echo "[deck-dev] ERROR: Gateway failed to start. Check $GATEWAY_LOG"
  return 1
}

start_deck() {
  stop_deck
  echo "[deck-dev] Starting Dashboard dev server on :$DECK_PORT ..."
  cd dashboard
  nohup pnpm dev > "$DECK_LOG" 2>&1 &
  cd ..
  for i in $(seq 1 15); do
    if lsof -i :$DECK_PORT -sTCP:LISTEN &>/dev/null; then
      echo "[deck-dev] Dashboard ready (pid $(lsof -ti :$DECK_PORT -sTCP:LISTEN | head -1))"
      return 0
    fi
    sleep 1
  done
  echo "[deck-dev] ERROR: Dashboard failed to start. Check $DECK_LOG"
  return 1
}

case "${1:-all}" in
  gateway)  start_gateway ;;
  deck)     start_deck ;;
  stop)     stop_gateway; stop_deck ;;
  all)      start_gateway && start_deck ;;
  *)
    echo "Usage: $0 [gateway|deck|stop|all]"
    exit 1
    ;;
esac
