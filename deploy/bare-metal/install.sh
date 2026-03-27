#!/usr/bin/env bash
#
# install.sh — Bare-metal installation for OpenClaw + Deck.
#
# Usage:
#   sudo deploy/bare-metal/install.sh
#
# Prerequisites: Node.js 22+, pnpm, git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

INSTALL_DIR="${OPENCLAW_INSTALL_DIR:-/opt/openclaw}"
STATE_DIR="${OPENCLAW_STATE_DIR:-/var/lib/openclaw}"
DECK_DATA_DIR="${DECK_DATA_DIR:-/var/lib/openclaw-deck}"
CONF_DIR="/etc/openclaw"

log() { echo "[install] $*"; }
err() { echo "[install] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

check_deps() {
  log "Checking dependencies..."
  command -v node >/dev/null || err "node not found. Install Node.js 22+"
  command -v pnpm >/dev/null || err "pnpm not found. Run: corepack enable"
  command -v git  >/dev/null || err "git not found"

  local node_major
  node_major=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  [ "$node_major" -ge 22 ] || err "Node.js 22+ required (found $node_major)"
  log "Dependencies OK (Node $node_major)"
}

# ---------------------------------------------------------------------------
# User setup
# ---------------------------------------------------------------------------

setup_user() {
  if ! id openclaw &>/dev/null; then
    log "Creating openclaw user..."
    useradd --system --create-home --shell /bin/bash openclaw
  fi
}

# ---------------------------------------------------------------------------
# Application install
# ---------------------------------------------------------------------------

install_app() {
  log "Installing to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"

  if [ "$REPO_DIR" = "$INSTALL_DIR" ]; then
    log "Repo is already at install path, skipping copy"
  else
    rsync -a --delete \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='deploy/data' \
      "$REPO_DIR/" "$INSTALL_DIR/"
  fi

  cd "$INSTALL_DIR"
  log "Installing dependencies..."
  pnpm install --frozen-lockfile

  log "Building Gateway..."
  pnpm build

  log "Building Deck..."
  cd dashboard
  pnpm build
  cd ..

  chown -R openclaw:openclaw "$INSTALL_DIR"
}

# ---------------------------------------------------------------------------
# Data directories + seed
# ---------------------------------------------------------------------------

setup_data() {
  mkdir -p "$STATE_DIR" "$DECK_DATA_DIR" "$CONF_DIR"

  if [ -f "$DEPLOY_DIR/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$DEPLOY_DIR/.env"
    set +a
  fi

  if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
    log "Generated gateway token: ${OPENCLAW_GATEWAY_TOKEN:0:8}..."
  fi
  export OPENCLAW_GATEWAY_TOKEN
  export DEFAULT_MODEL="${DEFAULT_MODEL:-deepseek/deepseek-chat}"

  "$DEPLOY_DIR/scripts/seed.sh" "$STATE_DIR"

  cat > "$CONF_DIR/gateway.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
OPENCLAW_STATE_DIR=${STATE_DIR}
EOF

  cat > "$CONF_DIR/deck.env" <<EOF
DECK_GATEWAY_URL=ws://localhost:18789
DECK_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
DECK_DB_PATH=${DECK_DATA_DIR}/deck.db
EOF

  chmod 600 "$CONF_DIR/gateway.env" "$CONF_DIR/deck.env"
  chown -R openclaw:openclaw "$STATE_DIR" "$DECK_DATA_DIR"

  log "Data directories initialized"
}

# ---------------------------------------------------------------------------
# systemd
# ---------------------------------------------------------------------------

install_services() {
  log "Installing systemd units..."
  cp "$SCRIPT_DIR/openclaw-gateway.service" /etc/systemd/system/
  cp "$SCRIPT_DIR/openclaw-deck.service" /etc/systemd/system/

  systemctl daemon-reload
  systemctl enable openclaw-gateway openclaw-deck

  log "Starting services..."
  systemctl start openclaw-gateway
  sleep 3
  systemctl start openclaw-deck

  log "Waiting for health..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:18789/healthz >/dev/null 2>&1; then
      log "Gateway healthy"
      break
    fi
    sleep 1
  done

  for i in $(seq 1 15); do
    if curl -sf http://localhost:3000 >/dev/null 2>&1; then
      log "Deck healthy"
      break
    fi
    sleep 1
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

[ "$(id -u)" -eq 0 ] || err "Run with sudo"

check_deps
setup_user
install_app
setup_data
install_services

log ""
log "========================================="
log "  OpenClaw + Deck installed successfully"
log "========================================="
log ""
log "  Deck:    http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost):3000"
log "  Gateway: http://localhost:18789"
log ""
log "  Manage:  systemctl {start|stop|restart} openclaw-gateway"
log "           systemctl {start|stop|restart} openclaw-deck"
log "  Logs:    journalctl -u openclaw-gateway -f"
log "           journalctl -u openclaw-deck -f"
log "  Config:  $CONF_DIR/"
log "  Data:    $STATE_DIR/"
log ""
