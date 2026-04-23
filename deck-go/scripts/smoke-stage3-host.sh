#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DECK_GO_SMOKE_DATA_DIR:-$(mktemp -d /tmp/deck-go-stage3-smoke.XXXXXX)}"
KEEP_DATA_DIR="${DECK_GO_SMOKE_KEEP_DATA_DIR:-0}"
ACCESS_TOKEN="${DECK_GO_SMOKE_ACCESS_TOKEN:-stage3-smoke-token}"
BACKEND_LOG="$(mktemp /tmp/deck-go-stage3-backend.XXXXXX.log)"
FRONTEND_LOG="$(mktemp /tmp/deck-go-stage3-frontend.XXXXXX.log)"

backend_pid=""
frontend_pid=""

pick_port() {
  python3 - <<'PY'
import socket

sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY
}

BACKEND_HOST="${DECK_GO_SMOKE_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${DECK_GO_SMOKE_BACKEND_PORT:-$(pick_port)}"
BACKEND_ADDR="${DECK_GO_SMOKE_BACKEND_ADDR:-${BACKEND_HOST}:${BACKEND_PORT}}"
BACKEND_BASE="http://${BACKEND_ADDR}"
FRONTEND_HOST="${DECK_GO_SMOKE_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${DECK_GO_SMOKE_FRONTEND_PORT:-$(pick_port)}"
FRONTEND_BASE="http://${FRONTEND_HOST}:${FRONTEND_PORT}"
curl_auth_args=()
if [[ -n "${ACCESS_TOKEN}" ]]; then
  curl_auth_args=(-H "x-deck-token: ${ACCESS_TOKEN}")
fi

cleanup() {
  local exit_code=$?

  if [[ -n "${frontend_pid}" ]] && kill -0 "${frontend_pid}" 2>/dev/null; then
    kill "${frontend_pid}" 2>/dev/null || true
    wait "${frontend_pid}" 2>/dev/null || true
  fi

  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
    wait "${backend_pid}" 2>/dev/null || true
  fi

  if [[ ${exit_code} -ne 0 ]]; then
    echo "[stage3-smoke] backend log:" >&2
    cat "${BACKEND_LOG}" >&2 || true
    echo "[stage3-smoke] frontend log:" >&2
    cat "${FRONTEND_LOG}" >&2 || true
  fi

  rm -f "${BACKEND_LOG}" "${FRONTEND_LOG}"
  if [[ "${KEEP_DATA_DIR}" != "1" ]]; then
    rm -rf "${DATA_DIR}"
  fi

  exit "${exit_code}"
}

trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local label="$2"
  shift 2
  local attempt=0

  until {
    if [[ $# -gt 0 ]]; then
      curl -sf "$@" "${url}" >/dev/null 2>&1
    else
      curl -sf "${url}" >/dev/null 2>&1
    fi
  }; do
    attempt=$((attempt + 1))
    if [[ ${attempt} -ge 40 ]]; then
      echo "[stage3-smoke] timed out waiting for ${label}: ${url}" >&2
      return 1
    fi
    sleep 0.5
  done
}

assert_status() {
  local url="$1"
  local label="$2"
  shift 2
  local expected_statuses=()
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--" ]]; then
      shift
      break
    fi
    expected_statuses+=("$1")
    shift
  done
  local body_file
  body_file="$(mktemp /tmp/deck-go-stage3-smoke-body.XXXXXX)"

  local status
  if [[ $# -gt 0 ]]; then
    status="$(curl -s -o "${body_file}" -w "%{http_code}" "$@" "${url}")"
  else
    status="$(curl -s -o "${body_file}" -w "%{http_code}" "${url}")"
  fi

  for expected in "${expected_statuses[@]}"; do
    if [[ "${status}" == "${expected}" ]]; then
      rm -f "${body_file}"
      echo "[stage3-smoke] ${label}: ${status}"
      return 0
    fi
  done

  echo "[stage3-smoke] unexpected status for ${label}: ${status}" >&2
  cat "${body_file}" >&2 || true
  rm -f "${body_file}"
  return 1
}

echo "[stage3-smoke] building Vite host"
(cd "${ROOT_DIR}/frontend" && VITE_DECK_GO_API_BASE="${BACKEND_BASE}" npm run build) >/dev/null

echo "[stage3-smoke] starting deck-go backend on ${BACKEND_ADDR}"
(
  cd "${ROOT_DIR}/backend"
  DECK_GO_ADDR="${BACKEND_ADDR}" \
  DECK_GO_DATA_DIR="${DATA_DIR}" \
  DECK_GO_ACCESS_TOKEN="${ACCESS_TOKEN}" \
  go run ./cmd/deck-go
) >"${BACKEND_LOG}" 2>&1 &
backend_pid=$!

wait_for_url "${BACKEND_BASE}/api/runtime/gateway" "deck-go backend" "${curl_auth_args[@]}"
wait_for_url "${BACKEND_BASE}/api/bootstrap/status" "deck-go bootstrap" "${curl_auth_args[@]}"

echo "[stage3-smoke] starting Vite preview on ${FRONTEND_BASE}"
(
  cd "${ROOT_DIR}/frontend"
  VITE_DECK_GO_API_BASE="${BACKEND_BASE}" \
  npm run preview -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}"
) >"${FRONTEND_LOG}" 2>&1 &
frontend_pid=$!

wait_for_url "${FRONTEND_BASE}/" "Vite preview host"

echo "[stage3-smoke] frontend root"
curl -si "${FRONTEND_BASE}/" | head -20
echo

echo "[stage3-smoke] runtime gateway"
curl -sf "${curl_auth_args[@]}" "${BACKEND_BASE}/api/runtime/gateway"
echo
echo

echo "[stage3-smoke] bootstrap status"
curl -sf "${curl_auth_args[@]}" "${BACKEND_BASE}/api/bootstrap/status"
echo
echo

assert_status "${BACKEND_BASE}/api/logs?limit=1" "logs" 200 502 -- "${curl_auth_args[@]}"
assert_status "${BACKEND_BASE}/api/models/config" "models config" 200 502 -- "${curl_auth_args[@]}"
assert_status "${BACKEND_BASE}/api/config" "config" 200 502 -- "${curl_auth_args[@]}"
assert_status "${BACKEND_BASE}/api/channels" "channels inventory" 200 502 -- "${curl_auth_args[@]}"
assert_status "${BACKEND_BASE}/api/deck/plugins" "plugins inventory" 200 502 -- "${curl_auth_args[@]}"
assert_status "${BACKEND_BASE}/api/sessions" "sessions inventory" 200 502 -- "${curl_auth_args[@]}"

echo
echo "[stage3-smoke] verified stable local surfaces plus runtime-backed inventory route wiring"
echo

echo "[stage3-smoke] browser shell probe"
(
  cd "${ROOT_DIR}/.."
  node deck-go/scripts/smoke-stage3-browser.mjs "${FRONTEND_BASE}" "${ACCESS_TOKEN}"
)
echo

echo "[stage3-smoke] Stage 3 host smoke passed"
