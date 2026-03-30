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
  log "Skipping init-once files, syncing always-sync content..."

  # always-sync: custom skills (overwrite on every deploy/upgrade)
  if [ -d "$SEED_DIR/skills" ]; then
    for skill_dir in "$SEED_DIR/skills"/*/; do
      [ -d "$skill_dir" ] || continue
      skill_name="$(basename "$skill_dir")"
      mkdir -p "$TARGET_DIR/skills/$skill_name"
      cp -a "$skill_dir"* "$TARGET_DIR/skills/$skill_name/" 2>/dev/null || true
      log "synced skill: $skill_name"
    done
  fi
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

  # 4. Extensions / plugins (init-once, directory copy)
  if [ -d "$SEED_DIR/extensions" ]; then
    for ext_dir in "$SEED_DIR/extensions"/*/; do
      [ -d "$ext_dir" ] || continue
      ext_name="$(basename "$ext_dir")"
      if [ ! -d "$TARGET_DIR/extensions/$ext_name" ] || [ "$FORCE" = "--force" ]; then
        mkdir -p "$TARGET_DIR/extensions/$ext_name"
        cp -a "$ext_dir"* "$TARGET_DIR/extensions/$ext_name/" 2>/dev/null || true
        log "seeded extension: $ext_name"
      else
        log "skip extension (exists): $ext_name"
      fi
    done
  fi

  # 5. Custom skills (always-sync — overwrite on every deploy/upgrade)
  if [ -d "$SEED_DIR/skills" ]; then
    for skill_dir in "$SEED_DIR/skills"/*/; do
      [ -d "$skill_dir" ] || continue
      skill_name="$(basename "$skill_dir")"
      # skills 始终覆盖（always-sync 策略）
      mkdir -p "$TARGET_DIR/skills/$skill_name"
      cp -a "$skill_dir"* "$TARGET_DIR/skills/$skill_name/" 2>/dev/null || true
      log "synced skill: $skill_name"
    done
  fi

  # 6. Merge plugins config into openclaw.json (if plugins-config.json exists)
  if [ -f "$SEED_DIR/plugins-config.json" ] && [ -f "$TARGET_DIR/openclaw.json" ]; then
    python3 -c "
import json, sys
with open('$TARGET_DIR/openclaw.json') as f:
    cfg = json.load(f)
with open('$SEED_DIR/plugins-config.json') as f:
    plugins = json.load(f)
cfg.setdefault('plugins', {}).update(plugins)
with open('$TARGET_DIR/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('[seed] merged plugins config into openclaw.json')
" 2>/dev/null || log "WARN: failed to merge plugins config"
  fi

  # Write marker
  echo "v1 $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MARKER"
  log "Seed marker written: $MARKER"
fi

log "Seed injection complete."
