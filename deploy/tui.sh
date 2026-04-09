#!/usr/bin/env bash
# tui.sh — Launch TUI client connected to the local Gateway.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source .env (contains OPENCLAW_GATEWAY_TOKEN)
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

SOURCE_DIR="$SCRIPT_DIR"
[ -d "$SCRIPT_DIR/source" ] && SOURCE_DIR="$SCRIPT_DIR/source"

if [ ! -f "$SOURCE_DIR/dist/cli.js" ]; then
  echo "[tui] ERROR: dist/cli.js not found. Run install.sh first."
  exit 1
fi

export NO_PROXY=localhost,127.0.0.1
exec node "$SOURCE_DIR/dist/cli.js" tui "$@"
