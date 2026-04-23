#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
DATA_DIR="${DECK_GO_ROLLBACK_SMOKE_DATA_DIR:-$(mktemp -d /tmp/deck-go-stage3-rollback.XXXXXX)}"
KEEP_DATA_DIR="${DECK_GO_ROLLBACK_KEEP_DATA_DIR:-0}"
ACCESS_TOKEN="${DECK_GO_ROLLBACK_ACCESS_TOKEN:-stage3-smoke-token}"
GATEWAY_TOKEN="${DECK_GO_ROLLBACK_GATEWAY_TOKEN:-stage3-gateway-token}"
BACKEND_LOG="$(mktemp /tmp/deck-go-stage3-rollback-backend.XXXXXX.log)"
DASHBOARD_LOG="$(mktemp /tmp/deck-go-stage3-rollback-dashboard.XXXXXX.log)"

backend_pid=""
dashboard_pid=""

pick_port() {
  python3 - <<'PY'
import socket

sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY
}

BACKEND_HOST="${DECK_GO_ROLLBACK_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${DECK_GO_ROLLBACK_BACKEND_PORT:-$(pick_port)}"
BACKEND_ADDR="${DECK_GO_ROLLBACK_BACKEND_ADDR:-${BACKEND_HOST}:${BACKEND_PORT}}"
BACKEND_BASE="http://${BACKEND_ADDR}"
DASHBOARD_HOST="${DECK_GO_ROLLBACK_DASHBOARD_HOST:-127.0.0.1}"
DASHBOARD_PORT="${DECK_GO_ROLLBACK_DASHBOARD_PORT:-3000}"
DASHBOARD_BASE="http://${DASHBOARD_HOST}:${DASHBOARD_PORT}"
GATEWAY_URL="${DECK_GO_ROLLBACK_GATEWAY_URL:-ws://127.0.0.1:18789}"

cleanup() {
  local exit_code=$?

  if [[ -n "${dashboard_pid}" ]] && kill -0 "${dashboard_pid}" 2>/dev/null; then
    kill "${dashboard_pid}" 2>/dev/null || true
    wait "${dashboard_pid}" 2>/dev/null || true
  fi

  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
    wait "${backend_pid}" 2>/dev/null || true
  fi

  if [[ ${exit_code} -ne 0 ]]; then
    echo "[stage3-rollback-smoke] backend log:" >&2
    cat "${BACKEND_LOG}" >&2 || true
    echo "[stage3-rollback-smoke] dashboard log:" >&2
    cat "${DASHBOARD_LOG}" >&2 || true
  fi

  rm -f "${BACKEND_LOG}" "${DASHBOARD_LOG}"
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

  until curl -sf "$@" "${url}" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ ${attempt} -ge 40 ]]; then
      echo "[stage3-rollback-smoke] timed out waiting for ${label}: ${url}" >&2
      return 1
    fi
    sleep 0.5
  done
}

wait_for_runtime_healthy() {
  python3 - "${BACKEND_BASE}" "${ACCESS_TOKEN}" <<'PY'
import json
import sys
import time
import urllib.request

base = sys.argv[1]
token = sys.argv[2]
url = f"{base}/api/runtime/gateway"
headers = {"x-deck-token": token} if token else {}

last = None
for _ in range(25):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.load(response)
    runtime = payload.get("runtime", {})
    last = runtime
    if runtime.get("status") == "running" and runtime.get("health") == "healthy":
        print("[stage3-rollback-smoke] managed gateway reached running/healthy")
        raise SystemExit(0)
    time.sleep(1)

print("[stage3-rollback-smoke] managed gateway did not reach running/healthy", file=sys.stderr)
print(json.dumps(last or {}, indent=2), file=sys.stderr)
raise SystemExit(1)
PY
}

start_runtime_gateway() {
  local body_file
  body_file="$(mktemp /tmp/deck-go-stage3-rollback-start-body.XXXXXX)"
  local status
  status="$(curl -s -o "${body_file}" -w "%{http_code}" -X POST -H "x-deck-token: ${ACCESS_TOKEN}" "${BACKEND_BASE}/api/runtime/gateway/start")"
  if [[ "${status}" != "200" ]]; then
    echo "[stage3-rollback-smoke] unexpected start status: ${status}" >&2
    cat "${body_file}" >&2 || true
    rm -f "${body_file}"
    return 1
  fi
  echo "[stage3-rollback-smoke] managed gateway start accepted"
  rm -f "${body_file}"
}

echo "[stage3-rollback-smoke] starting deck-go backend on ${BACKEND_ADDR}"
(
  cd "${ROOT_DIR}/backend"
  DECK_GO_ADDR="${BACKEND_ADDR}" \
  DECK_GO_DATA_DIR="${DATA_DIR}" \
  DECK_GO_ACCESS_TOKEN="${ACCESS_TOKEN}" \
  DECK_GO_GATEWAY_TOKEN="${GATEWAY_TOKEN}" \
  go run ./cmd/deck-go
) >"${BACKEND_LOG}" 2>&1 &
backend_pid=$!

wait_for_url "${BACKEND_BASE}/api/runtime/gateway" "deck-go backend" -H "x-deck-token: ${ACCESS_TOKEN}"
start_runtime_gateway
wait_for_runtime_healthy

echo "[stage3-rollback-smoke] starting legacy dashboard on ${DASHBOARD_BASE}"
(
  cd "${REPO_ROOT}/dashboard"
  PORT="${DASHBOARD_PORT}" \
  HOSTNAME="${DASHBOARD_HOST}" \
  pnpm dev
) >"${DASHBOARD_LOG}" 2>&1 &
dashboard_pid=$!

wait_for_url "${DASHBOARD_BASE}/" "legacy dashboard"

echo "[stage3-rollback-smoke] running legacy live smoke against ${GATEWAY_URL}"
(
  cd "${REPO_ROOT}/dashboard"
  PLAYWRIGHT_EXTERNAL_SERVER=1 \
  PLAYWRIGHT_LIVE_SMOKE=1 \
  PLAYWRIGHT_BASE_URL="${DASHBOARD_BASE}" \
  PLAYWRIGHT_GATEWAY_URL="${GATEWAY_URL}" \
  OPENCLAW_GATEWAY_TOKEN="${GATEWAY_TOKEN}" \
  pnpm test:e2e:live
)

echo "[stage3-rollback-smoke] rollback rehearsal smoke passed"
