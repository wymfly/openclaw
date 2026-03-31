#!/usr/bin/env bash
#
# prepare-deps.sh — Download Windows deployment prerequisites for offline install.
#
# Usage:
#   deploy/scripts/prepare-deps.sh              # Download all (Node.js + Docker Desktop)
#   deploy/scripts/prepare-deps.sh --node-only  # Node.js MSI only (bare-metal mode)
#   deploy/scripts/prepare-deps.sh --docker-only # Docker Desktop only
#
# Output: deploy/deps/ directory with Windows installers
#
# These deps are optional — install.sh detects missing tools and prints
# install guides. Pre-downloaded deps speed up deployment on air-gapped
# or slow-network Windows machines.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPS_DIR="$DEPLOY_DIR/deps"

# --- Versions (update these when upgrading) ---
NODE_VERSION="22.22.2"

# --- Download URLs (Windows only) ---
NODE_WIN_X64="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-x64.msi"
NODE_WIN_ARM64="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-arm64.msi"
DOCKER_DESKTOP_WIN="https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

log() { echo "[prepare-deps] $*"; }
err() { echo "[prepare-deps] ERROR: $*" >&2; exit 1; }

download() {
  local url="$1" dest="$2"
  if [ -f "$dest" ]; then
    log "Already exists: $(basename "$dest")"
    return 0
  fi
  log "Downloading $(basename "$dest")..."
  if command -v curl >/dev/null 2>&1; then
    curl -fSL --progress-bar -o "$dest" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "$dest" "$url"
  else
    err "Neither curl nor wget found"
  fi
  log "Downloaded: $(basename "$dest") ($(du -h "$dest" | cut -f1))"
}

download_node() {
  local dir="$DEPS_DIR/node"
  mkdir -p "$dir"

  log "=== Node.js v${NODE_VERSION} (Windows) ==="
  download "$NODE_WIN_X64"   "$dir/node-v${NODE_VERSION}-x64.msi"
  download "$NODE_WIN_ARM64" "$dir/node-v${NODE_VERSION}-arm64.msi"
}

download_docker() {
  local dir="$DEPS_DIR/docker"
  mkdir -p "$dir"

  log "=== Docker Desktop (Windows) ==="
  log "Note: Docker Desktop is free for personal use and small businesses (<250 employees)."
  log "      Larger organizations require a paid subscription."
  download "$DOCKER_DESKTOP_WIN" "$dir/DockerDesktopInstaller.exe"
}

write_readme() {
  cat > "$DEPS_DIR/README.md" <<'EOF'
# Windows Deployment Dependencies (Offline Installers)

Pre-downloaded installers for air-gapped or slow-network Windows deployment.

## Contents

### node/
Node.js 22 LTS Windows installers.

| File | Platform | Install |
|------|----------|---------|
| `node-*-x64.msi` | Windows x64 | Double-click, follow wizard |
| `node-*-arm64.msi` | Windows ARM64 | Double-click, follow wizard |

After Node.js install, open PowerShell and run:
```powershell
npm install -g pnpm pm2
```

### docker/
Docker Desktop installer for Windows.

| File | Platform | Install |
|------|----------|---------|
| `DockerDesktopInstaller.exe` | Windows x64 | Run as admin, enable WSL 2 backend |

**Prerequisites:** WSL 2 must be enabled before installing Docker Desktop:
```powershell
wsl --install
# Reboot, then install Docker Desktop
```

**Licensing:** Docker Desktop is free for personal use and small businesses
(< 250 employees / < $10M annual revenue). Larger organizations need a
[paid subscription](https://www.docker.com/pricing/).

## Install Order

1. Install Node.js from `node/*.msi`
2. Open PowerShell: `npm install -g pnpm pm2`
3. (Optional) Install Docker Desktop from `docker/DockerDesktopInstaller.exe`
4. Run `deploy\scripts\install.sh bare-metal` (or `docker`)
EOF
  log "README written to deps/README.md"
}

# --- Main ---
mkdir -p "$DEPS_DIR"

DOWNLOAD_NODE=true
DOWNLOAD_DOCKER=true

case "${1:-}" in
  --node-only)   DOWNLOAD_DOCKER=false ;;
  --docker-only) DOWNLOAD_NODE=false ;;
  -h|--help)
    echo "Usage: $0 [--node-only|--docker-only]"
    echo ""
    echo "Downloads Windows deployment prerequisites to deploy/deps/"
    echo "  --node-only   Node.js MSI only (~60MB)"
    echo "  --docker-only Docker Desktop only (~550MB)"
    echo "  (no args)     All (~610MB)"
    exit 0 ;;
  "") ;; # download all
  *) err "Unknown argument: $1" ;;
esac

if [ "$DOWNLOAD_NODE" = true ]; then
  download_node
fi

if [ "$DOWNLOAD_DOCKER" = true ]; then
  download_docker
fi

write_readme

echo ""
log "=== Dependencies prepared ==="
log "Location: $DEPS_DIR"
du -sh "$DEPS_DIR"
echo ""
log "Include in deploy package with: deploy/scripts/package.sh --with-deps"
