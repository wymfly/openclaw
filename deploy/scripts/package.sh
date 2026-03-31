#!/usr/bin/env bash
#
# package.sh — Build and package OpenClaw + Deck for deployment.
#
# Usage:
#   deploy/scripts/package.sh                     # A-layer: source only
#   deploy/scripts/package.sh --with-images       # A+B: source + Docker images
#   deploy/scripts/package.sh --with-prebuilt     # A+C: source + pre-built artifacts
#   deploy/scripts/package.sh --full              # A+B+C: everything
#   deploy/scripts/package.sh --with-local        # Include runtime plugins + skills
#   deploy/scripts/package.sh --with-deps         # Include pre-downloaded deps (deploy/deps/)
#   deploy/scripts/package.sh --platform linux    # Docker platform: linux/amd64
#   deploy/scripts/package.sh --platform mac      # Docker platform: linux/arm64
#   deploy/scripts/package.sh --output /path      # Custom output directory
#
# Package layers:
#   A (source)   — Source code + deploy scripts + seed data (~50MB)
#   B (images)   — Docker images as .tar.gz (~800MB)
#   C (prebuilt) — Gateway dist + Deck standalone (~60MB)
#
# Output: openclaw-deploy-YYYYMMDD-HHMMSS.tar.gz + manifest.json
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
PKG_NAME="openclaw-deploy-$TIMESTAMP"
OUTPUT_DIR="${DEPLOY_DIR}"

# Defaults
WITH_IMAGES=false
WITH_PREBUILT=false
WITH_LOCAL=false
WITH_DEPS=false
DOCKER_PLATFORM=""
HAS_IMAGES=false
HAS_PREBUILT=false
HAS_LOCAL=false
HAS_DEPS=false

log() { echo "[package] $*"; }
err() { echo "[package] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-images)   WITH_IMAGES=true; shift ;;
    --with-prebuilt) WITH_PREBUILT=true; shift ;;
    --full)          WITH_IMAGES=true; WITH_PREBUILT=true; shift ;;
    --with-local)    WITH_LOCAL=true; shift ;;
    --with-deps)     WITH_DEPS=true; shift ;;
    --platform)
      shift
      case "${1:-}" in
        linux) DOCKER_PLATFORM="linux/amd64" ;;
        mac)   DOCKER_PLATFORM="linux/arm64" ;;
        *)     err "Unknown platform: ${1:-}. Use 'linux' or 'mac'." ;;
      esac
      shift ;;
    --output) shift; OUTPUT_DIR="${1:-$OUTPUT_DIR}"; shift ;;
    -h|--help)
      head -20 "$0" | grep "^#" | sed 's/^# \?//'
      exit 0 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

# ---------------------------------------------------------------------------
# Staging directory
# ---------------------------------------------------------------------------
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

log "Staging to $STAGING_DIR/$PKG_NAME"
mkdir -p "$STAGING_DIR/$PKG_NAME"

# ---------------------------------------------------------------------------
# Layer A: Source (always included)
# ---------------------------------------------------------------------------
stage_source() {
  log "Staging source via git archive..."
  cd "$REPO_DIR"
  git archive HEAD --prefix=source/ | tar -C "$STAGING_DIR/$PKG_NAME" -x

  # Copy deploy/ scripts (may have uncommitted changes)
  rsync -a \
    --exclude='data' \
    --exclude='.env' \
    --exclude='*.tar.gz' \
    --exclude='*.zip' \
    --exclude='.DS_Store' \
    --exclude='ecosystem.config.cjs' \
    "$DEPLOY_DIR/" "$STAGING_DIR/$PKG_NAME/source/deploy/"

  log "Source staged"
}

# ---------------------------------------------------------------------------
# Layer B: Docker images
# ---------------------------------------------------------------------------
stage_images() {
  log "Building Docker images..."
  cd "$DEPLOY_DIR/docker"

  local platform_flag=""
  if [ -n "$DOCKER_PLATFORM" ]; then
    platform_flag="--platform $DOCKER_PLATFORM"
  fi

  # Build Gateway
  # shellcheck disable=SC2086
  docker build \
    $platform_flag \
    -f "$REPO_DIR/Dockerfile" \
    --build-arg OPENCLAW_DOCKER_APT_PACKAGES="python3 python3-pip ripgrep jq wget" \
    --build-arg OPENCLAW_INSTALL_DOCKER_CLI=1 \
    -t openclaw-gateway:package \
    "$REPO_DIR"

  # Build Deck
  # shellcheck disable=SC2086
  docker build \
    $platform_flag \
    -f "$DEPLOY_DIR/docker/Dockerfile.deck" \
    -t openclaw-deck:package \
    "$REPO_DIR"

  # Export images
  local img_dir="$STAGING_DIR/$PKG_NAME/images"
  mkdir -p "$img_dir"

  log "Exporting openclaw-gateway image..."
  docker save openclaw-gateway:package | gzip > "$img_dir/openclaw-gateway.tar.gz"

  log "Exporting openclaw-deck image..."
  docker save openclaw-deck:package | gzip > "$img_dir/openclaw-deck.tar.gz"

  HAS_IMAGES=true
  log "Docker images staged"
}

# ---------------------------------------------------------------------------
# Layer C: Pre-built artifacts
# ---------------------------------------------------------------------------
stage_prebuilt() {
  log "Staging pre-built artifacts..."
  local src="$STAGING_DIR/$PKG_NAME/source"

  # Gateway dist
  if [ -d "$REPO_DIR/dist" ]; then
    cp -r "$REPO_DIR/dist" "$src/dist"
  else
    err "Gateway dist/ not found. Run 'pnpm build' first."
  fi

  # Deck standalone
  local standalone="$REPO_DIR/dashboard/.next/standalone"
  if [ -d "$standalone" ]; then
    mkdir -p "$src/dashboard/.next"
    cp -r "$standalone" "$src/dashboard/.next/standalone"
    # Static assets
    [ -d "$REPO_DIR/dashboard/.next/static" ] && \
      cp -r "$REPO_DIR/dashboard/.next/static" "$src/dashboard/.next/standalone/dashboard/.next/static"
    # Public assets
    [ -d "$REPO_DIR/dashboard/public" ] && \
      cp -r "$REPO_DIR/dashboard/public" "$src/dashboard/.next/standalone/dashboard/public"
    # Migrations
    [ -d "$REPO_DIR/dashboard/migrations" ] && \
      cp -r "$REPO_DIR/dashboard/migrations" "$src/dashboard/.next/standalone/dashboard/migrations"
  else
    err "Deck standalone not found. Run 'cd dashboard && npx next build --webpack' first."
  fi

  HAS_PREBUILT=true
  log "Pre-built artifacts staged"
}

# ---------------------------------------------------------------------------
# Local extensions + skills
# ---------------------------------------------------------------------------
stage_local() {
  local home="${OPENCLAW_HOME:-$HOME}"
  local oc_dir="$home/.openclaw"

  # Extensions
  if [ -d "$oc_dir/extensions" ]; then
    local seed_ext="$STAGING_DIR/$PKG_NAME/source/deploy/seed/extensions"
    mkdir -p "$seed_ext"
    for ext_dir in "$oc_dir/extensions"/*/; do
      [ -d "$ext_dir" ] || continue
      local name
      name="$(basename "$ext_dir")"
      cp -r "$ext_dir" "$seed_ext/$name"
      log "Collected extension: $name"
    done
  fi

  # Skills
  if [ -d "$oc_dir/skills" ]; then
    local seed_skills="$STAGING_DIR/$PKG_NAME/source/deploy/seed/skills"
    mkdir -p "$seed_skills"
    for skill_dir in "$oc_dir/skills"/*/; do
      [ -d "$skill_dir" ] || continue
      local name
      name="$(basename "$skill_dir")"
      cp -r "$skill_dir" "$seed_skills/$name"
      log "Collected skill: $name"
    done
  fi

  HAS_LOCAL=true
  log "Local content staged"
}

# ---------------------------------------------------------------------------
# Pre-downloaded dependencies (deploy/deps/)
# ---------------------------------------------------------------------------
stage_deps() {
  local deps_src="$DEPLOY_DIR/deps"
  if [ ! -d "$deps_src" ]; then
    err "deploy/deps/ not found. Run 'deploy/scripts/prepare-deps.sh' first."
  fi

  local deps_dst="$STAGING_DIR/$PKG_NAME/deps"
  cp -r "$deps_src" "$deps_dst"

  local count
  count=$(find "$deps_dst" -type f \( -name "*.msi" -o -name "*.exe" -o -name "*.tar.*" \) | wc -l | tr -d ' ')
  HAS_DEPS=true
  log "Dependencies staged ($count installer files)"
}

# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
write_manifest() {
  cat > "$STAGING_DIR/$PKG_NAME/manifest.json" <<EOF
{
  "format": 1,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit": "$(cd "$REPO_DIR" && git rev-parse --short HEAD)",
  "branch": "$(cd "$REPO_DIR" && git branch --show-current)",
  "contents": {
    "source": true,
    "prebuilt": $HAS_PREBUILT,
    "dockerImages": $HAS_IMAGES,
    "dockerPlatform": "$DOCKER_PLATFORM",
    "localExtensions": $HAS_LOCAL,
    "offlineDeps": $HAS_DEPS
  }
}
EOF
  log "Manifest written"
}

# ---------------------------------------------------------------------------
# Top-level install.sh forwarder
# ---------------------------------------------------------------------------
write_installer() {
  cat > "$STAGING_DIR/$PKG_NAME/install.sh" <<'INSTALLER'
#!/usr/bin/env bash
exec "$(dirname "$0")/source/deploy/scripts/install.sh" "$@"
INSTALLER
  chmod +x "$STAGING_DIR/$PKG_NAME/install.sh"
}

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
verify_package() {
  log "Verifying package integrity..."
  local ok=true

  [ -f "$STAGING_DIR/$PKG_NAME/manifest.json" ] || { log "FAIL: manifest.json missing"; ok=false; }
  [ -d "$STAGING_DIR/$PKG_NAME/source" ] || { log "FAIL: source/ missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/source/deploy/scripts/install.sh" ] || { log "FAIL: install.sh missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/source/deploy/scripts/seed.js" ] || { log "FAIL: seed.js missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/install.sh" ] || { log "FAIL: top-level install.sh missing"; ok=false; }

  if [ "$HAS_PREBUILT" = true ]; then
    [ -f "$STAGING_DIR/$PKG_NAME/source/dist/cli-startup-metadata.json" ] || { log "FAIL: Gateway dist missing"; ok=false; }
    [ -f "$STAGING_DIR/$PKG_NAME/source/dashboard/.next/standalone/dashboard/server.js" ] || { log "FAIL: Deck standalone missing"; ok=false; }
  fi

  if [ "$HAS_IMAGES" = true ]; then
    [ -f "$STAGING_DIR/$PKG_NAME/images/openclaw-gateway.tar.gz" ] || { log "FAIL: Gateway image missing"; ok=false; }
    [ -f "$STAGING_DIR/$PKG_NAME/images/openclaw-deck.tar.gz" ] || { log "FAIL: Deck image missing"; ok=false; }
  fi

  [ "$ok" = true ] || err "Package verification failed"
  log "Package verified OK"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Layer A: always
stage_source

# Layer B: optional
if [ "$WITH_IMAGES" = true ]; then
  stage_images
fi

# Layer C: optional
if [ "$WITH_PREBUILT" = true ]; then
  stage_prebuilt
fi

# Deps: optional
if [ "$WITH_DEPS" = true ]; then
  stage_deps
fi

# Local content: optional
if [ "$WITH_LOCAL" = true ]; then
  stage_local
fi

# Write manifest + installer
write_manifest
write_installer

# Verify
verify_package

# Package
mkdir -p "$OUTPUT_DIR"
local_tar="$OUTPUT_DIR/$PKG_NAME.tar.gz"
log "Creating $local_tar..."
tar czf "$local_tar" -C "$STAGING_DIR" "$PKG_NAME"

# Summary
local_size=$(du -sh "$local_tar" | cut -f1)
log "=== Package complete ==="
log "File: $local_tar"
log "Size: $local_size"
log "Layers: source$([ "$HAS_IMAGES" = true ] && echo " + images")$([ "$HAS_PREBUILT" = true ] && echo " + prebuilt")$([ "$HAS_LOCAL" = true ] && echo " + local")$([ "$HAS_DEPS" = true ] && echo " + deps")"
log ""
log "To deploy:"
log "  scp $local_tar user@target:/tmp/"
log "  ssh user@target 'tar xzf /tmp/$PKG_NAME.tar.gz && cd $PKG_NAME && ./install.sh'"
