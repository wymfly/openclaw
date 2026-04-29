#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK_GO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPO_ROOT="$(cd "${DECK_GO_DIR}/.." && pwd)"

generate_token() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
    return
  fi
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr -d '-'
    return
  fi
  date +%s%N
}

DEV_TOKEN="${DECK_GO_DEV_TOKEN:-$(generate_token)}"

export DECK_GO_ADDR="${DECK_GO_ADDR:-127.0.0.1:19566}"
export DECK_GO_DATA_DIR="${DECK_GO_DATA_DIR:-${DECK_GO_DIR}/.local/dev-bundled/data}"
export DECK_GO_ACCESS_TOKEN="${DECK_GO_ACCESS_TOKEN:-${DEV_TOKEN}}"
export RUNTIME_MODE="bundled"
export RUNTIME_BUNDLED_COMMAND="${RUNTIME_BUNDLED_COMMAND:-pnpm}"
export RUNTIME_BUNDLED_ARGS="${RUNTIME_BUNDLED_ARGS:-openclaw gateway run --bind loopback --port 18789}"
export RUNTIME_BUNDLED_WORKDIR="${RUNTIME_BUNDLED_WORKDIR:-${REPO_ROOT}}"
export RUNTIME_BUNDLED_BIND_HOST="${RUNTIME_BUNDLED_BIND_HOST:-127.0.0.1}"
export RUNTIME_BUNDLED_BIND_PORT="${RUNTIME_BUNDLED_BIND_PORT:-18789}"
export RUNTIME_BUNDLED_TOKEN="${RUNTIME_BUNDLED_TOKEN:-${DEV_TOKEN}}"
export RUNTIME_BUNDLED_AUTO_START="${RUNTIME_BUNDLED_AUTO_START:-true}"
export RUNTIME_BUNDLED_ENV_NO_PROXY="${RUNTIME_BUNDLED_ENV_NO_PROXY:-localhost,127.0.0.1,::1}"
export RUNTIME_BUNDLED_ENV_OPENCLAW_STATE_DIR="${RUNTIME_BUNDLED_ENV_OPENCLAW_STATE_DIR:-${DECK_GO_DIR}/.local/dev-bundled/openclaw-state}"

mkdir -p "${DECK_GO_DATA_DIR}" "${RUNTIME_BUNDLED_ENV_OPENCLAW_STATE_DIR}"

exec "${DECK_GO_BIN:-deck-go}"

