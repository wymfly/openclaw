#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK_GO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPO_ROOT="$(cd "${DECK_GO_DIR}/.." && pwd)"
OPENCLAW_REPO_ROOT="${OPENCLAW_REPO_ROOT:-${REPO_ROOT}}"

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

service_hash() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "${OPENCLAW_REPO_ROOT}" | shasum -a 256 | awk '{print substr($1, 1, 12)}'
    return
  fi
  printf '%s' "${OPENCLAW_REPO_ROOT}" | sha256sum | awk '{print substr($1, 1, 12)}'
}

DEV_TOKEN="${DECK_GO_DEV_TOKEN:-$(generate_token)}"
SERVICE_NAME="openclaw-gateway.$(service_hash)"
ENTRYPOINT="${OPENCLAW_REPO_ROOT}/dist/entry.js"

if [[ ! -f "${ENTRYPOINT}" ]]; then
  echo "[run-local] missing ${ENTRYPOINT}; run pnpm build from the OpenClaw repo root first." >&2
  exit 64
fi

export DECK_GO_ADDR="${DECK_GO_ADDR:-127.0.0.1:19566}"
export DECK_GO_DATA_DIR="${DECK_GO_DATA_DIR:-${DECK_GO_DIR}/.local/dev-local/data}"
export DECK_GO_ACCESS_TOKEN="${DECK_GO_ACCESS_TOKEN:-${DEV_TOKEN}}"
export RUNTIME_MODE="local"
export OPENCLAW_REPO_ROOT
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-${DECK_GO_DIR}/.local/dev-local/openclaw-state}"
export OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-${DEV_TOKEN}}"
export OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
export OPENCLAW_LAUNCHD_LABEL="${SERVICE_NAME}"
export OPENCLAW_SYSTEMD_UNIT="${SERVICE_NAME}"
export OPENCLAW_WINDOWS_TASK_NAME="${SERVICE_NAME}"

if [[ -z "${DECK_DOTENV_FILE:-}" && -f "${DECK_GO_DIR}/.env.local" ]]; then
  export DECK_DOTENV_FILE="${DECK_GO_DIR}/.env.local"
fi

mkdir -p "${DECK_GO_DATA_DIR}" "${OPENCLAW_STATE_DIR}"

node "${ENTRYPOINT}" gateway install \
  --port "${OPENCLAW_GATEWAY_PORT}" \
  --token "${OPENCLAW_GATEWAY_TOKEN}" \
  --force
node "${ENTRYPOINT}" gateway start

exec "${DECK_GO_BIN:-deck-go}"
