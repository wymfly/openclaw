#!/usr/bin/env bash
#
# package.sh — Build and package OpenClaw + Deck for deployment.
#
# Usage:
#   deploy/scripts/package.sh                     # A-layer: source only
#   deploy/scripts/package.sh --with-images       # A+B: source + Docker images
#   deploy/scripts/package.sh --with-prebuilt     # A+C: source + pre-built artifacts
#   deploy/scripts/package.sh --windows-self-contained # A+C + source/node_modules from current platform
#   deploy/scripts/package.sh --full              # A+B+C: everything
#   deploy/scripts/package.sh --with-local        # Include runtime plugins + skills
#   deploy/scripts/package.sh --with-node-modules # Include source/node_modules if present
#   deploy/scripts/package.sh --with-deps         # Include pre-downloaded deps (deploy/deps/)
#   deploy/scripts/package.sh --platform linux    # Docker platform: linux/amd64
#   deploy/scripts/package.sh --platform mac      # Docker platform: linux/arm64
#   deploy/scripts/package.sh --bootstrap-base-url https://host/path
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

# Prevent macOS from injecting ._* AppleDouble resource fork files into archives
export COPYFILE_DISABLE=1

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
WITH_NODE_MODULES=false
WITH_DEPS=false
DOCKER_PLATFORM=""
BOOTSTRAP_BASE_URL=""
HAS_IMAGES=false
HAS_PREBUILT=false
HAS_LOCAL=false
HAS_NODE_MODULES=false
HAS_DEPS=false

log() { echo "[package] $*"; }
err() { echo "[package] ERROR: $*" >&2; exit 1; }

compute_sha256() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return
  fi
  python - <<'PY' "$file"
import hashlib, sys
path = sys.argv[1]
h = hashlib.sha256()
with open(path, 'rb') as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b''):
        h.update(chunk)
print(h.hexdigest())
PY
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-images)   WITH_IMAGES=true; shift ;;
    --with-prebuilt) WITH_PREBUILT=true; shift ;;
    --windows-self-contained) WITH_PREBUILT=true; WITH_NODE_MODULES=true; shift ;;
    --full)          WITH_IMAGES=true; WITH_PREBUILT=true; shift ;;
    --with-local)    WITH_LOCAL=true; shift ;;
    --with-node-modules) WITH_NODE_MODULES=true; shift ;;
    --with-deps)     WITH_DEPS=true; shift ;;
    --platform)
      shift
      case "${1:-}" in
        linux) DOCKER_PLATFORM="linux/amd64" ;;
        mac)   DOCKER_PLATFORM="linux/arm64" ;;
        *)     err "Unknown platform: ${1:-}. Use 'linux' or 'mac'." ;;
      esac
      shift ;;
    --bootstrap-base-url) shift; BOOTSTRAP_BASE_URL="${1:-}"; shift ;;
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
    --exclude='deps' \
    --exclude='.env' \
    --exclude='openclaw-deploy-*' \
    --exclude='*.tar.gz' \
    --exclude='*.zip' \
    --exclude='.DS_Store' \
    --exclude='._*' \
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
  log "Building fresh artifacts to ensure package includes latest code..."
  local src="$STAGING_DIR/$PKG_NAME/source"

  # Always rebuild Gateway from source
  log "Building Gateway..."
  (cd "$REPO_DIR" && pnpm build)
  cp -r "$REPO_DIR/dist" "$src/dist"

  # Always rebuild Deck from source
  log "Building Deck..."
  rm -rf "$REPO_DIR/dashboard/.next"
  (cd "$REPO_DIR/dashboard" && pnpm install && npx next build --webpack)

  local standalone="$REPO_DIR/dashboard/.next/standalone"
  mkdir -p "$src/dashboard/.next"
  cp -r "$standalone" "$src/dashboard/.next/standalone"
  # Static assets
  [ -d "$REPO_DIR/dashboard/.next/static" ] && \
    cp -r "$REPO_DIR/dashboard/.next/static" "$src/dashboard/.next/standalone/dashboard/.next/static"
  # Public assets
  [ -d "$REPO_DIR/dashboard/public" ] && \
    cp -r "$REPO_DIR/dashboard/public" "$src/dashboard/.next/standalone/dashboard/public"
  # Standalone entry (wrapper that starts server.js)
  [ -f "$REPO_DIR/dashboard/standalone-entry.mjs" ] && \
    cp "$REPO_DIR/dashboard/standalone-entry.mjs" "$src/dashboard/.next/standalone/dashboard/standalone-entry.mjs"

  HAS_PREBUILT=true
  log "Fresh artifacts built and staged"
}

# ---------------------------------------------------------------------------
# Optional runtime node_modules (platform-specific)
# ---------------------------------------------------------------------------
stage_node_modules() {
  local src="$REPO_DIR/node_modules"
  [ -d "$src" ] || err "--with-node-modules requested but $src is missing. Run pnpm install on the target platform first."

  log "Staging source/node_modules..."
  mkdir -p "$STAGING_DIR/$PKG_NAME/source"
  rsync -a \
    --exclude='.cache' \
    --exclude='.pnpm-store' \
    --exclude='.vite' \
    "$src/" "$STAGING_DIR/$PKG_NAME/source/node_modules/"

  HAS_NODE_MODULES=true
  log "source/node_modules staged"
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
  # Compute checksums for incremental upgrade detection
  local lockfile_hash="" dist_hash="" standalone_hash=""
  local src="$STAGING_DIR/$PKG_NAME/source"
  [ -f "$src/pnpm-lock.yaml" ] && lockfile_hash=$(shasum -a 256 "$src/pnpm-lock.yaml" | cut -d' ' -f1)
  [ -f "$src/dist/cli-startup-metadata.json" ] && dist_hash=$(shasum -a 256 "$src/dist/cli-startup-metadata.json" | cut -d' ' -f1)
  [ -f "$src/dashboard/.next/standalone/dashboard/server.js" ] && standalone_hash=$(shasum -a 256 "$src/dashboard/.next/standalone/dashboard/server.js" | cut -d' ' -f1)

  # Read seed version (defaults to 1)
  local seed_version=1
  [ -f "$DEPLOY_DIR/seed/VERSION" ] && seed_version=$(cat "$DEPLOY_DIR/seed/VERSION" 2>/dev/null || echo 1)

  # Extract env var names from .env.example
  local env_vars=""
  if [ -f "$DEPLOY_DIR/.env.example" ]; then
    env_vars=$(grep -E '^[A-Z_][A-Z0-9_]*=' "$DEPLOY_DIR/.env.example" | cut -d= -f1 | sort | while read -r v; do printf '"%s",' "$v"; done | sed 's/,$//')
  fi

  # Read version from package.json
  local pkg_version=""
  pkg_version=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$REPO_DIR/package.json','utf8')).version||'')" 2>/dev/null || echo "")

  cat > "$STAGING_DIR/$PKG_NAME/manifest.json" <<EOF
{
  "format": 2,
  "version": "$pkg_version",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit": "$(cd "$REPO_DIR" && git rev-parse --short HEAD)",
  "branch": "$(cd "$REPO_DIR" && git branch --show-current)",
  "seedVersion": $seed_version,
  "checksums": {
    "lockfile": "$lockfile_hash",
    "gatewayDist": "$dist_hash",
    "deckStandalone": "$standalone_hash"
  },
  "envVars": [$env_vars],
  "contents": {
    "source": true,
    "prebuilt": $HAS_PREBUILT,
    "nodeModules": $HAS_NODE_MODULES,
    "dockerImages": $HAS_IMAGES,
    "dockerPlatform": "$DOCKER_PLATFORM",
    "localExtensions": $HAS_LOCAL,
    "offlineDeps": $HAS_DEPS
  }
}
EOF
  log "Manifest written (format 2, seedVersion=$seed_version)"
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

  for script in install update start stop status; do
    cat > "$STAGING_DIR/$PKG_NAME/${script}.ps1" <<PSEOF
& (Join-Path \$PSScriptRoot "source\\deploy\\${script}.ps1") @Args
exit \$LASTEXITCODE
PSEOF
  done

  # Ops scripts — start/stop/status/tui forwarders (sh + bat)
  for script in start.sh stop.sh status.sh tui.sh; do
    cat > "$STAGING_DIR/$PKG_NAME/$script" <<OPSEOF
#!/usr/bin/env bash
exec "\$(dirname "\$0")/source/deploy/$script" "\$@"
OPSEOF
    chmod +x "$STAGING_DIR/$PKG_NAME/$script"
  done

  for name in start stop status tui; do
    local bat_src="$DEPLOY_DIR/${name}.bat"
    if [ -f "$bat_src" ]; then
      cp "$bat_src" "$STAGING_DIR/$PKG_NAME/${name}.bat"
    else
      printf '@echo off\r\nsetlocal\r\nset "SD=%%~dp0"\r\nwhere bash >nul 2>&1 && (bash "%%SD%%source\\deploy\\%s.sh" %%* & goto :d)\r\nif exist "C:\\Program Files\\Git\\bin\\bash.exe" ("C:\\Program Files\\Git\\bin\\bash.exe" "%%SD%%source\\deploy\\%s.sh" %%* & goto :d)\r\necho bash not found. & pause & exit /b 1\r\n:d\r\nif %%ERRORLEVEL%% neq 0 pause\r\nendlocal\r\n' "$name" "$name" > "$STAGING_DIR/$PKG_NAME/${name}.bat"
    fi
  done
  log "Ops scripts (start/stop/status/tui .sh + .bat) written"

  # Windows install.bat — copy from deploy dir (has pause + registry detection)
  if [ -f "$DEPLOY_DIR/install.bat" ]; then
    cp "$DEPLOY_DIR/install.bat" "$STAGING_DIR/$PKG_NAME/install.bat"
  fi
  if [ -f "$DEPLOY_DIR/update.bat" ]; then
    cp "$DEPLOY_DIR/update.bat" "$STAGING_DIR/$PKG_NAME/update.bat"
  fi
}

# ---------------------------------------------------------------------------
# Platform-specific install guides
# ---------------------------------------------------------------------------
write_readme() {
  local docs_src="$DEPLOY_DIR/docs"
  local pkg_root="$STAGING_DIR/$PKG_NAME"

  # Determine primary platform hint from package contents
  local primary_platform=""
  if [ "$HAS_DEPS" = true ]; then
    primary_platform="Windows"
  fi

  # Copy all platform guides
  for guide in INSTALL-Windows.md INSTALL-Linux.md INSTALL-macOS.md; do
    [ -f "$docs_src/$guide" ] && cp "$docs_src/$guide" "$pkg_root/$guide"
  done

  # Generate top-level README
  cat > "$pkg_root/README.md" <<READMEEOF
# OpenClaw 安装包

## 包内容

| 层 | 包含 |
|----|------|
| 源码 | $([ "$HAS_PREBUILT" = true ] && echo "是（含预构建产物，无需编译）" || echo "是（需要编译）") |
| Runtime node_modules | $([ "$HAS_NODE_MODULES" = true ] && echo "是（平台绑定，自包含）" || echo "否") |
| Docker 镜像 | $([ "$HAS_IMAGES" = true ] && echo "是" || echo "否") |
| 本地插件/Skills | $([ "$HAS_LOCAL" = true ] && echo "是" || echo "否") |
| Windows 离线依赖 | $([ "$HAS_DEPS" = true ] && echo "是（Git + Node.js + Docker Desktop）" || echo "否") |

## 安装指南

请根据目标系统选择对应的安装指南：

- **[Windows 安装指南](INSTALL-Windows.md)**$([ "$primary_platform" = "Windows" ] && echo " ← 推荐（本包含 Windows 离线依赖）")
- **[Linux 安装指南](INSTALL-Linux.md)**
- **[macOS 安装指南](INSTALL-macOS.md)**

## 快速开始（一键安装）

\`\`\`bash
# 1. 解压
tar xzf $(basename "$pkg_root").tar.gz
cd $(basename "$pkg_root")

# 2. 安装（自动安装依赖 + 创建 .env + 构建 + 启动）
bash install.sh bare-metal
# Windows: 双击 install.bat

# 3. 运维
bash status.sh    # 查看状态（Windows: 双击 status.bat）
bash start.sh     # 启动（Windows: 双击 start.bat）
bash stop.sh      # 停止（Windows: 双击 stop.bat）
\`\`\`

API Key 和 Token 已预填，无需手动编辑 \`.env\`。

$([ "$HAS_NODE_MODULES" = true ] && echo "> 该包包含当前打包平台的 \`source/node_modules\`，适合发布给相同平台/架构的用户。" || true)

## 验证

- Gateway: http://localhost:18789/healthz
- Deck Dashboard: http://localhost:3000
READMEEOF

  log "README written"
}

write_windows_bootstrap_assets() {
  local tar_path="$1"
  [ -n "$BOOTSTRAP_BASE_URL" ] || return 0

  local normalized_base
  normalized_base="${BOOTSTRAP_BASE_URL%/}"
  local package_file
  package_file="$(basename "$tar_path")"
  local package_sha
  package_sha="$(compute_sha256 "$tar_path")"
  local version
  version="$(node -e "const pkg=JSON.parse(require('fs').readFileSync('$REPO_DIR/package.json','utf8'));process.stdout.write(pkg.version||'unknown')")"

  local manifest_out="$OUTPUT_DIR/windows-latest.json"
  cat > "$manifest_out" <<EOF
{
  "channel": "stable",
  "version": "$version",
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "packageFile": "$package_file",
  "packageUrl": "$normalized_base/$package_file",
  "packageSha256": "$package_sha"
}
EOF

  local bootstrap_src="$DEPLOY_DIR/bootstrap-install.ps1"
  [ -f "$bootstrap_src" ] || err "Missing bootstrap installer template: $bootstrap_src"
  local bootstrap_out="$OUTPUT_DIR/install.ps1"
  sed "s#__WINDOWS_MANIFEST_URL__#$normalized_base/windows-latest.json#g" "$bootstrap_src" > "$bootstrap_out"

  log "Windows bootstrap manifest written: $manifest_out"
  log "Windows bootstrap installer written: $bootstrap_out"
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
  [ -f "$STAGING_DIR/$PKG_NAME/install.bat" ] || { log "FAIL: top-level install.bat missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/start.sh" ] || { log "FAIL: top-level start.sh missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/stop.sh" ] || { log "FAIL: top-level stop.sh missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/status.sh" ] || { log "FAIL: top-level status.sh missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/start.bat" ] || { log "FAIL: top-level start.bat missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/stop.bat" ] || { log "FAIL: top-level stop.bat missing"; ok=false; }
  [ -f "$STAGING_DIR/$PKG_NAME/status.bat" ] || { log "FAIL: top-level status.bat missing"; ok=false; }

  if [ "$HAS_PREBUILT" = true ]; then
    [ -f "$STAGING_DIR/$PKG_NAME/source/dist/cli-startup-metadata.json" ] || { log "FAIL: Gateway dist missing"; ok=false; }
    [ -f "$STAGING_DIR/$PKG_NAME/source/dashboard/.next/standalone/dashboard/server.js" ] || { log "FAIL: Deck standalone missing"; ok=false; }
  fi

  if [ "$HAS_NODE_MODULES" = true ]; then
    [ -d "$STAGING_DIR/$PKG_NAME/source/node_modules" ] || { log "FAIL: source/node_modules missing"; ok=false; }
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

if [ "$WITH_NODE_MODULES" = true ]; then
  stage_node_modules
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
write_readme

# Verify
verify_package

# Package
mkdir -p "$OUTPUT_DIR"
local_tar="$OUTPUT_DIR/$PKG_NAME.tar.gz"
log "Creating $local_tar..."
tar_args=(czf "$local_tar" -C "$STAGING_DIR" "$PKG_NAME")
if [[ "$(uname -s)" == "Darwin" ]]; then
  tar_args=(czf "$local_tar" --no-mac-metadata --no-xattrs -C "$STAGING_DIR" "$PKG_NAME")
fi
tar "${tar_args[@]}"
write_windows_bootstrap_assets "$local_tar"

# Summary
local_size=$(du -sh "$local_tar" | cut -f1)
log "=== Package complete ==="
log "File: $local_tar"
log "Size: $local_size"
log "Layers: source$([ "$HAS_IMAGES" = true ] && echo " + images")$([ "$HAS_PREBUILT" = true ] && echo " + prebuilt")$([ "$HAS_NODE_MODULES" = true ] && echo " + node_modules")$([ "$HAS_LOCAL" = true ] && echo " + local")$([ "$HAS_DEPS" = true ] && echo " + deps")"
log ""
if [ -n "$BOOTSTRAP_BASE_URL" ]; then
  log "Windows bootstrap assets:"
  log "  $OUTPUT_DIR/install.ps1"
  log "  $OUTPUT_DIR/windows-latest.json"
  log "Windows one-liner:"
  log "  iwr -useb ${BOOTSTRAP_BASE_URL%/}/install.ps1 | iex"
  log ""
fi
log "To deploy (Linux/macOS):"
log "  scp $local_tar user@target:/tmp/"
log "  ssh user@target 'tar xzf /tmp/$PKG_NAME.tar.gz && cd $PKG_NAME && ./install.sh'"
log ""
log "To deploy (Windows):"
log "  Extract $PKG_NAME.tar.gz, then run: install.bat"
