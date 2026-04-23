#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DECK_GO_SMOKE_DATA_DIR:-$(mktemp -d /tmp/deck-go-stage3-smoke.XXXXXX)}"
KEEP_DATA_DIR="${DECK_GO_SMOKE_KEEP_DATA_DIR:-0}"
ACCESS_TOKEN="${DECK_GO_SMOKE_ACCESS_TOKEN:-stage3-smoke-token}"
GATEWAY_TOKEN="${DECK_GO_SMOKE_GATEWAY_TOKEN:-}"
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

  local status=""
  local attempts=0
  while [[ ${attempts} -lt 10 ]]; do
    attempts=$((attempts + 1))
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

    sleep 1
  done

  echo "[stage3-smoke] unexpected status for ${label}: ${status}" >&2
  cat "${body_file}" >&2 || true
  rm -f "${body_file}"
  return 1
}

assert_runtime_start_preflight() {
  local body_file
  body_file="$(mktemp /tmp/deck-go-stage3-smoke-start-body.XXXXXX)"
  local status
  status="$(curl -s -o "${body_file}" -w "%{http_code}" -X POST "${curl_auth_args[@]}" "${BACKEND_BASE}/api/runtime/gateway/start")"

  if [[ "${status}" != "400" ]]; then
    echo "[stage3-smoke] unexpected start preflight status: ${status}" >&2
    cat "${body_file}" >&2 || true
    rm -f "${body_file}"
    return 1
  fi

  if ! grep -q "managed gateway token is required" "${body_file}"; then
    echo "[stage3-smoke] runtime start preflight response missing expected error" >&2
    cat "${body_file}" >&2 || true
    rm -f "${body_file}"
    return 1
  fi

  echo "[stage3-smoke] runtime start preflight: 400 managed gateway token is required"
  rm -f "${body_file}"
}

assert_runtime_start_with_gateway_token() {
  local body_file
  body_file="$(mktemp /tmp/deck-go-stage3-smoke-start-body.XXXXXX)"
  local status
  status="$(curl -s -o "${body_file}" -w "%{http_code}" -X POST "${curl_auth_args[@]}" "${BACKEND_BASE}/api/runtime/gateway/start")"

  if [[ "${status}" != "200" ]]; then
    echo "[stage3-smoke] unexpected start status with gateway token: ${status}" >&2
    cat "${body_file}" >&2 || true
    rm -f "${body_file}"
    return 1
  fi

  if ! grep -q '"configured":true' "${body_file}"; then
    echo "[stage3-smoke] runtime start response missing configured=true" >&2
    cat "${body_file}" >&2 || true
    rm -f "${body_file}"
    return 1
  fi

  echo "[stage3-smoke] runtime start accepted with configured gateway token"
  rm -f "${body_file}"

  local runtime_file
  runtime_file="$(mktemp /tmp/deck-go-stage3-smoke-runtime.XXXXXX)"
  local runtime_status
  runtime_status="$(curl -s -o "${runtime_file}" -w "%{http_code}" "${curl_auth_args[@]}" "${BACKEND_BASE}/api/runtime/gateway")"
  if [[ "${runtime_status}" != "200" ]]; then
    echo "[stage3-smoke] runtime summary fetch failed after start: ${runtime_status}" >&2
    cat "${runtime_file}" >&2 || true
    rm -f "${runtime_file}"
    return 1
  fi
  if ! grep -q '"configured":true' "${runtime_file}"; then
    echo "[stage3-smoke] runtime summary after start missing configured=true" >&2
    cat "${runtime_file}" >&2 || true
    rm -f "${runtime_file}"
    return 1
  fi
  echo "[stage3-smoke] runtime summary after start remains configured"
  rm -f "${runtime_file}"
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
for _ in range(20):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.load(response)
    runtime = payload.get("runtime", {})
    last = runtime
    if runtime.get("status") == "running" and runtime.get("health") == "healthy":
        print("[stage3-smoke] runtime reached running/healthy")
        raise SystemExit(0)
    time.sleep(1)

print("[stage3-smoke] runtime did not reach running/healthy", file=sys.stderr)
print(json.dumps(last or {}, indent=2), file=sys.stderr)
raise SystemExit(1)
PY
}

wait_for_runtime_stopped() {
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
for _ in range(20):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.load(response)
    runtime = payload.get("runtime", {})
    last = runtime
    if runtime.get("status") == "stopped":
        print("[stage3-smoke] runtime reached stopped")
        raise SystemExit(0)
    time.sleep(1)

print("[stage3-smoke] runtime did not reach stopped", file=sys.stderr)
print(json.dumps(last or {}, indent=2), file=sys.stderr)
raise SystemExit(1)
PY
}

assert_runtime_stop_restart_cycle() {
  local stop_file
  stop_file="$(mktemp /tmp/deck-go-stage3-smoke-stop-body.XXXXXX)"
  local stop_status
  stop_status="$(curl -s -o "${stop_file}" -w "%{http_code}" -X POST "${curl_auth_args[@]}" "${BACKEND_BASE}/api/runtime/gateway/stop")"
  if [[ "${stop_status}" != "200" ]]; then
    echo "[stage3-smoke] unexpected stop status: ${stop_status}" >&2
    cat "${stop_file}" >&2 || true
    rm -f "${stop_file}"
    return 1
  fi
  echo "[stage3-smoke] runtime stop accepted"
  rm -f "${stop_file}"

  wait_for_runtime_stopped
  assert_runtime_start_with_gateway_token
  wait_for_runtime_healthy
}

assert_chat_send_abort() {
  python3 - "${BACKEND_BASE}" "${ACCESS_TOKEN}" <<'PY'
import json
import sys
import time
import urllib.request
import urllib.error

base = sys.argv[1]
token = sys.argv[2]

def request(path, body=None):
    last_error = None
    for _ in range(5):
        data = json.dumps(body).encode() if body is not None else None
        headers = {"x-deck-token": token}
        if body is not None:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(base + path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code != 502:
                raise
            time.sleep(1)
    raise last_error

created = request("/api/chat/sessions/create", {"agentId": "main"})
session_key = created.get("key")
if not session_key:
    raise SystemExit("[stage3-smoke] chat create response missing session key")

sent = request(
    "/api/chat/send",
    {
        "sessionKey": session_key,
        "message": "What number comes immediately after 314158? Reply with digits only.",
    },
)
run_id = sent.get("runId")
if not run_id or sent.get("status") not in {"started", "in_flight"}:
    raise SystemExit("[stage3-smoke] chat send response missing active run status")

history = None
assistant_text = ""
for _ in range(20):
    history = request(f"/api/chat/history?sessionKey={session_key}&limit=20")
    messages = history.get("messages") or []
    roles = {message.get("role") for message in messages}
    assistant_texts = []
    for message in messages:
        if message.get("role") != "assistant":
            continue
        for block in message.get("content") or []:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                assistant_texts.append(block["text"])
    assistant_text = " ".join(assistant_texts)
    if "user" in roles and "assistant" in roles and "314159" in assistant_text:
        break
    time.sleep(1)
else:
    raise SystemExit("[stage3-smoke] chat history never exposed the expected assistant response")

aborted = request("/api/chat/abort", {"sessionKey": session_key, "runId": run_id})
abort_status = aborted.get("status")
if abort_status not in {"aborted", "no-active-run"}:
    raise SystemExit("[stage3-smoke] chat abort response missing known terminal status")

print(f"[stage3-smoke] chat create/send/history/abort flow proved ({abort_status}; assistant={assistant_text})")
PY
}

echo "[stage3-smoke] building Vite host"
(cd "${ROOT_DIR}/frontend" && VITE_DECK_GO_API_BASE="${BACKEND_BASE}" npm run build) >/dev/null

echo "[stage3-smoke] starting deck-go backend on ${BACKEND_ADDR}"
if [[ -n "${GATEWAY_TOKEN}" ]]; then
  (
    cd "${ROOT_DIR}/backend"
    DECK_GO_ADDR="${BACKEND_ADDR}" \
    DECK_GO_DATA_DIR="${DATA_DIR}" \
    DECK_GO_ACCESS_TOKEN="${ACCESS_TOKEN}" \
    DECK_GO_GATEWAY_TOKEN="${GATEWAY_TOKEN}" \
    go run ./cmd/deck-go
  ) >"${BACKEND_LOG}" 2>&1 &
else
  (
    cd "${ROOT_DIR}/backend"
    DECK_GO_ADDR="${BACKEND_ADDR}" \
    DECK_GO_DATA_DIR="${DATA_DIR}" \
    DECK_GO_ACCESS_TOKEN="${ACCESS_TOKEN}" \
    go run ./cmd/deck-go
  ) >"${BACKEND_LOG}" 2>&1 &
fi
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

if [[ -n "${GATEWAY_TOKEN}" ]]; then
  assert_runtime_start_with_gateway_token
  wait_for_runtime_healthy
else
  assert_runtime_start_preflight
fi
echo

if [[ -n "${GATEWAY_TOKEN}" ]]; then
  assert_status "${BACKEND_BASE}/api/logs?limit=1" "logs" 200 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/models/config" "models config" 200 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/config" "config" 200 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/channels" "channels inventory" 200 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/deck/plugins" "plugins inventory" 200 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/sessions" "sessions inventory" 200 -- "${curl_auth_args[@]}"
  assert_chat_send_abort
else
  assert_status "${BACKEND_BASE}/api/logs?limit=1" "logs" 200 502 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/models/config" "models config" 200 502 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/config" "config" 200 502 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/channels" "channels inventory" 200 502 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/deck/plugins" "plugins inventory" 200 502 -- "${curl_auth_args[@]}"
  assert_status "${BACKEND_BASE}/api/sessions" "sessions inventory" 200 502 -- "${curl_auth_args[@]}"
fi

echo
echo "[stage3-smoke] verified stable local surfaces plus runtime-backed inventory route wiring"
echo

echo "[stage3-smoke] browser shell probe"
(
  cd "${ROOT_DIR}/.."
  node deck-go/scripts/smoke-stage3-browser.mjs "${FRONTEND_BASE}" "${ACCESS_TOKEN}" "$(if [[ -n "${GATEWAY_TOKEN}" ]]; then echo rich; else echo basic; fi)"
)
echo

if [[ -n "${GATEWAY_TOKEN}" ]]; then
  echo "[stage3-smoke] lifecycle restart probe"
  assert_runtime_stop_restart_cycle
  echo
fi

echo "[stage3-smoke] Stage 3 host smoke passed"
