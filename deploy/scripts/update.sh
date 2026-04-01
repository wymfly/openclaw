#!/usr/bin/env bash
#
# update.sh — Incremental update for OpenClaw + Deck deployment.
#
# Usage:
#   deploy/scripts/update.sh <new-package.tar.gz>        # Update from package
#   deploy/scripts/update.sh <new-package.tar.gz> --dry   # Preview changes only
#
# Preserves:
#   - deploy/.env (API keys, tokens)
#   - data/.openclaw/ (config, agents, sessions, auth profiles, cron, extensions)
#   - data/openclaw-deck/deck.db (Deck database — migrations auto-upgrade)
#
# Replaces:
#   - source code, build output, deploy scripts
#   - skills (always-sync)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect install root: package layout or repo layout
if [ -f "$DEPLOY_DIR/../../manifest.json" ]; then
  INSTALL_ROOT="$(cd "$DEPLOY_DIR/../.." && pwd)"
  SOURCE_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
else
  INSTALL_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
  SOURCE_DIR="$INSTALL_ROOT"
fi

log() { echo "[update] $*"; }
err() { echo "[update] ERROR: $*" >&2; exit 1; }
warn() { echo "[update] WARN: $*"; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
PACKAGE="${1:-}"
DRY_RUN=false
[ "${2:-}" = "--dry" ] && DRY_RUN=true

if [ -z "$PACKAGE" ] || [ "$PACKAGE" = "--dry" ]; then
  echo "Usage: $0 <new-package.tar.gz> [--dry]"
  echo ""
  echo "  Performs an incremental update preserving user data."
  echo "  --dry   Preview what will change without applying."
  exit 1
fi

[ -f "$PACKAGE" ] || err "Package not found: $PACKAGE"

# Resolve absolute path
PACKAGE="$(cd "$(dirname "$PACKAGE")" && pwd)/$(basename "$PACKAGE")"

# ---------------------------------------------------------------------------
# Extract new package to temp
# ---------------------------------------------------------------------------
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

log "Extracting package..."
tar xzf "$PACKAGE" -C "$TEMP_DIR"

# Find the extracted directory (first dir in temp)
NEW_PKG_DIR="$(find "$TEMP_DIR" -maxdepth 1 -mindepth 1 -type d | head -1)"
[ -d "$NEW_PKG_DIR" ] || err "No directory found in package"

# Locate source in new package
NEW_SOURCE="$NEW_PKG_DIR/source"
[ -d "$NEW_SOURCE" ] || NEW_SOURCE="$NEW_PKG_DIR"
[ -f "$NEW_SOURCE/package.json" ] || err "Invalid package: package.json not found"

# ---------------------------------------------------------------------------
# Version comparison
# ---------------------------------------------------------------------------
get_version() {
  node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$1/package.json','utf8')).version||'unknown')" 2>/dev/null || echo "unknown"
}

CURRENT_VERSION="$(get_version "$SOURCE_DIR")"
NEW_VERSION="$(get_version "$NEW_SOURCE")"

log "Current version: $CURRENT_VERSION"
log "New version:     $NEW_VERSION"

if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
  warn "Same version. Proceeding anyway (may contain fixes)."
fi

# ---------------------------------------------------------------------------
# Detect what needs updating
# ---------------------------------------------------------------------------
NEEDS_INSTALL=false
NEEDS_REBUILD=false

# Check if lockfile changed
if ! diff -q "$SOURCE_DIR/pnpm-lock.yaml" "$NEW_SOURCE/pnpm-lock.yaml" >/dev/null 2>&1; then
  log "Dependencies changed — will run pnpm install"
  NEEDS_INSTALL=true
fi

# Check if prebuilt artifacts exist in new package
HAS_NEW_PREBUILT=false
if [ -f "$NEW_SOURCE/dist/cli-startup-metadata.json" ] && \
   [ -f "$NEW_SOURCE/dashboard/.next/standalone/dashboard/server.js" ]; then
  HAS_NEW_PREBUILT=true
  log "New package includes prebuilt artifacts"
else
  NEEDS_REBUILD=true
  NEEDS_INSTALL=true
  log "No prebuilt artifacts — will need to build from source"
fi

# ---------------------------------------------------------------------------
# Dry run — just show what would happen
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = true ]; then
  echo ""
  log "=== Dry Run Summary ==="
  log "Package:    $(basename "$PACKAGE")"
  log "Version:    $CURRENT_VERSION → $NEW_VERSION"
  log "Install deps: $NEEDS_INSTALL"
  log "Rebuild:      $NEEDS_REBUILD"
  echo ""
  log "Will PRESERVE:"
  log "  deploy/.env"
  log "  data/.openclaw/ (config, agents, sessions, cron, extensions)"
  log "  data/openclaw-deck/deck.db"
  log "  deploy/ecosystem.config.cjs"
  echo ""
  log "Will REPLACE:"
  log "  Source code (src/, dashboard/src/, etc.)"
  [ "$HAS_NEW_PREBUILT" = true ] && log "  Build output (dist/, dashboard/.next/)"
  log "  Deploy scripts (deploy/scripts/)"
  log "  Skills (always-sync)"
  echo ""
  log "Run without --dry to apply."
  exit 0
fi

# ---------------------------------------------------------------------------
# Stop services
# ---------------------------------------------------------------------------
log "Stopping services..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop all 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------------
BACKUP_DIR="$INSTALL_ROOT/.backup-$(date +%Y%m%d-%H%M%S)"
log "Creating backup at $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Backup user data
[ -d "$SOURCE_DIR/data" ] && cp -r "$SOURCE_DIR/data" "$BACKUP_DIR/data"
[ -f "$DEPLOY_DIR/.env" ] && cp "$DEPLOY_DIR/.env" "$BACKUP_DIR/.env"
[ -f "$DEPLOY_DIR/ecosystem.config.cjs" ] && cp "$DEPLOY_DIR/ecosystem.config.cjs" "$BACKUP_DIR/ecosystem.config.cjs"

log "Backup complete"

# ---------------------------------------------------------------------------
# Replace source code (preserve data + .env + ecosystem)
# ---------------------------------------------------------------------------
log "Updating source code..."

# Save paths to preserve
ENV_FILE="$DEPLOY_DIR/.env"
ECOSYSTEM_FILE="$DEPLOY_DIR/ecosystem.config.cjs"
DATA_DIR="$SOURCE_DIR/data"

# Move data out temporarily
TEMP_DATA="$TEMP_DIR/_preserved_data"
mkdir -p "$TEMP_DATA"
[ -d "$DATA_DIR" ] && mv "$DATA_DIR" "$TEMP_DATA/data"
[ -f "$ENV_FILE" ] && cp "$ENV_FILE" "$TEMP_DATA/.env"
[ -f "$ECOSYSTEM_FILE" ] && cp "$ECOSYSTEM_FILE" "$TEMP_DATA/ecosystem.config.cjs"

# Replace source with rsync (exclude data, .env, ecosystem)
rsync -a --delete \
  --exclude='data' \
  --exclude='.env' \
  --exclude='ecosystem.config.cjs' \
  --exclude='node_modules' \
  --exclude='.DS_Store' \
  --exclude='._*' \
  "$NEW_SOURCE/" "$SOURCE_DIR/"

# Restore preserved data
[ -d "$TEMP_DATA/data" ] && mv "$TEMP_DATA/data" "$DATA_DIR"
[ -f "$TEMP_DATA/.env" ] && cp "$TEMP_DATA/.env" "$ENV_FILE"
[ -f "$TEMP_DATA/ecosystem.config.cjs" ] && cp "$TEMP_DATA/ecosystem.config.cjs" "$ECOSYSTEM_FILE"

log "Source code updated"

# ---------------------------------------------------------------------------
# Install dependencies (if needed)
# ---------------------------------------------------------------------------
cd "$SOURCE_DIR"

if [ "$NEEDS_INSTALL" = true ]; then
  log "Installing dependencies..."
  pnpm install --frozen-lockfile
fi

# ---------------------------------------------------------------------------
# Build (if no prebuilt)
# ---------------------------------------------------------------------------
if [ "$NEEDS_REBUILD" = true ]; then
  log "Building Gateway..."
  pnpm build

  log "Building Deck..."
  (cd dashboard && npx next build --webpack)
  [ -d dashboard/.next/static ] && \
    cp -r dashboard/.next/static dashboard/.next/standalone/dashboard/.next/static
  [ -d dashboard/public ] && \
    cp -r dashboard/public dashboard/.next/standalone/dashboard/public
fi

# ---------------------------------------------------------------------------
# Post-update fixups
# ---------------------------------------------------------------------------

# Ensure standalone-entry.mjs is in place
if [ -f dashboard/standalone-entry.mjs ] && [ ! -f dashboard/.next/standalone/dashboard/standalone-entry.mjs ]; then
  cp dashboard/standalone-entry.mjs dashboard/.next/standalone/dashboard/standalone-entry.mjs
  log "Copied standalone-entry.mjs"
fi

# Ensure sql-wasm.wasm is in standalone
local_wasm="dashboard/.next/standalone/node_modules/sql.js/dist/sql-wasm.wasm"
if [ ! -f "$local_wasm" ]; then
  wasm_src=""
  [ -f "node_modules/sql.js/dist/sql-wasm.wasm" ] && wasm_src="node_modules/sql.js/dist/sql-wasm.wasm"
  [ -z "$wasm_src" ] && [ -f "dashboard/node_modules/sql.js/dist/sql-wasm.wasm" ] && wasm_src="dashboard/node_modules/sql.js/dist/sql-wasm.wasm"
  if [ -n "$wasm_src" ]; then
    mkdir -p "$(dirname "$local_wasm")"
    cp "$wasm_src" "$local_wasm"
    log "Copied sql-wasm.wasm"
  fi
fi

# Sync skills (always-sync strategy)
log "Syncing skills..."
node deploy/scripts/seed.js "$DATA_DIR/.openclaw" 2>/dev/null || \
  node deploy/scripts/seed.js data/.openclaw 2>/dev/null || true

# Regenerate ecosystem config (picks up new env vars / port changes)
log "Regenerating PM2 config..."
# Source .env for generate-ecosystem
set -a
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"
set +a
node deploy/scripts/generate-ecosystem.js "$SOURCE_DIR"

# ---------------------------------------------------------------------------
# Restart services
# ---------------------------------------------------------------------------
log "Starting services..."
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo ""
log "=== Update complete ==="
log "Version: $CURRENT_VERSION → $NEW_VERSION"
log "Backup:  $BACKUP_DIR"
log ""
log "Verify:"
log "  pm2 status"
log "  pm2 logs --lines 10"
log "  curl -s http://localhost:${GATEWAY_PORT:-18789}/healthz"
log "  curl -s http://localhost:${DECK_PORT:-3000}"
log ""
log "Rollback (if needed):"
log "  pm2 stop all"
log "  cp $BACKUP_DIR/.env $ENV_FILE"
log "  cp -r $BACKUP_DIR/data/* $DATA_DIR/"
log "  pm2 restart all"
