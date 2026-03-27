#!/usr/bin/env bash
#
# seed.sh — Inject seed data into the target OpenClaw state directory.
#
# Usage:
#   deploy/scripts/seed.sh <target-dir> [--force]
#
# Env vars read from the environment (typically loaded from .env by setup.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_DIR="$(cd "$SCRIPT_DIR/../seed" && pwd)"
TARGET_DIR="${1:?Usage: seed.sh <target-dir> [--force]}"
FORCE="${2:-}"

MARKER="$TARGET_DIR/.seed-initialized"

log() { echo "[seed] $*"; }

# ---------------------------------------------------------------------------
# envsubst wrapper — only substitute defined variables
# ---------------------------------------------------------------------------
render_template() {
  local src="$1" dst="$2"
  # Build envsubst variable list from what's actually set
  local vars=""
  for var in DEEPSEEK_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY \
             OPENCLAW_GATEWAY_TOKEN DEFAULT_MODEL \
             TELEGRAM_BOT_TOKEN DISCORD_BOT_TOKEN; do
    if [ -n "${!var:-}" ]; then
      vars="$vars \${$var}"
    fi
  done

  if [ -n "$vars" ]; then
    envsubst "$vars" < "$src" > "$dst"
  else
    cp "$src" "$dst"
  fi
}

# ---------------------------------------------------------------------------
# init-once: copy only if target does not exist
# ---------------------------------------------------------------------------
seed_init_once() {
  local src="$1" dst="$2"
  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    log "skip (exists): $dst"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  if [[ "$src" == *.tmpl ]]; then
    local dst_no_tmpl="${dst%.tmpl}"
    render_template "$src" "$dst_no_tmpl"
    log "rendered: $dst_no_tmpl"
  else
    cp -a "$src" "$dst"
    log "copied: $dst"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

mkdir -p "$TARGET_DIR"

if [ -f "$MARKER" ] && [ "$FORCE" != "--force" ]; then
  log "Target already initialized ($(cat "$MARKER")). Use --force to re-seed."
  log "Skipping init-once files, only syncing always-sync content."
else
  log "Initializing $TARGET_DIR from seed..."

  # 1. Main config (init-once, template)
  seed_init_once "$SEED_DIR/openclaw.json.tmpl" "$TARGET_DIR/openclaw.json.tmpl"

  # 2. Agents (init-once, directory copy)
  if [ -d "$SEED_DIR/agents" ]; then
    for agent_dir in "$SEED_DIR/agents"/*/; do
      agent_name="$(basename "$agent_dir")"
      if [ ! -d "$TARGET_DIR/agents/$agent_name" ] || [ "$FORCE" = "--force" ]; then
        mkdir -p "$TARGET_DIR/agents/$agent_name"
        cp -a "$agent_dir"* "$TARGET_DIR/agents/$agent_name/" 2>/dev/null || true
        log "seeded agent: $agent_name"
      else
        log "skip agent (exists): $agent_name"
      fi
    done
  fi

  # 3. Cron (init-once)
  if [ -d "$SEED_DIR/cron" ]; then
    mkdir -p "$TARGET_DIR/cron"
    seed_init_once "$SEED_DIR/cron/jobs.json" "$TARGET_DIR/cron/jobs.json"
  fi

  # Write marker
  echo "v1 $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MARKER"
  log "Seed marker written: $MARKER"
fi

log "Seed injection complete."
