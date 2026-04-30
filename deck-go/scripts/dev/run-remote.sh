#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK_GO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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

export DECK_GO_ADDR="${DECK_GO_ADDR:-127.0.0.1:19566}"
export DECK_GO_DATA_DIR="${DECK_GO_DATA_DIR:-${DECK_GO_DIR}/.local/dev-remote/data}"
export DECK_GO_ACCESS_TOKEN="${DECK_GO_ACCESS_TOKEN:-$(generate_token)}"
export RUNTIME_MODE="remote"
export RUNTIME_REMOTE_URL="${RUNTIME_REMOTE_URL:-}"
export RUNTIME_REMOTE_TOKEN="${RUNTIME_REMOTE_TOKEN:-}"
export RUNTIME_REMOTE_TLS_VERIFY="${RUNTIME_REMOTE_TLS_VERIFY:-true}"

mkdir -p "${DECK_GO_DATA_DIR}"

echo "deck-go remote mode starts without a Gateway endpoint; configure it in Settings first-run."
exec "${DECK_GO_BIN:-deck-go}"
