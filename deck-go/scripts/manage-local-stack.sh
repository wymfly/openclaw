#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
ENV_FILE="${DECK_GO_STACK_ENV:-${ROOT_DIR}/.env}"
STATE_DIR="${ROOT_DIR}/.local/deck-go-stack"
PID_DIR="${STATE_DIR}/pids"
LOG_DIR="${STATE_DIR}/logs"
BIN_DIR="${STATE_DIR}/bin"
BACKEND_PID_FILE="${PID_DIR}/backend.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend.pid"
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
BACKEND_BIN="${BIN_DIR}/deck-go"
FRONTEND_BIN="${ROOT_DIR}/frontend/node_modules/.bin/vite"
GO_ENV=(
  GOCACHE=/tmp/deck-go-buildcache
  GOSUMDB=off
)
DEFAULT_NPM_CACHE="/tmp/deck-go-npm-cache"

mkdir -p "${PID_DIR}" "${LOG_DIR}" "${BIN_DIR}"

usage() {
  cat <<'EOF'
usage: deck-go/scripts/manage-local-stack.sh <command>

commands:
  start         build frontend, start backend, start Vite preview
  stop          stop frontend and backend
  restart       stop then start
  status        show process and runtime status
  logs          tail backend/frontend logs
  backend-fg    build and run backend in the foreground
  frontend-fg   run Vite preview in the foreground
  runtime-start ask deck-go to start the managed local Gateway
  runtime-stop  ask deck-go to stop the managed local Gateway
  chat-smoke    deprecated: use the Codex Playwright plugin instead
EOF
}

load_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "[deck-go-local] missing env file: ${ENV_FILE}" >&2
    echo "[deck-go-local] copy deck-go/.env.example to deck-go/.env and retry" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  : "${DECK_GO_ADDR:=127.0.0.1:19566}"
  : "${DECK_GO_DATA_DIR:=.local/deck-go-stack/data}"
  : "${DECK_GO_ACCESS_TOKEN:=stage3-local-access-token}"
  : "${DECK_GO_GATEWAY_AUTO_START:=true}"
  : "${DECK_GO_FRONTEND_HOST:=127.0.0.1}"
  : "${DECK_GO_FRONTEND_PORT:=4174}"
  : "${VITE_DECK_GO_API_BASE:=http://${DECK_GO_ADDR}}"
  : "${VITE_DECK_VISUAL_STATE:=1}"
  : "${DECK_GO_RUNTIME_ACTION_TIMEOUT:=300}"

  local local_no_proxy="localhost,127.0.0.1,::1"
  if [[ -n "${NO_PROXY:-}" ]]; then
    NO_PROXY="${local_no_proxy},${NO_PROXY}"
  else
    NO_PROXY="${local_no_proxy}"
  fi
  if [[ -n "${no_proxy:-}" ]]; then
    no_proxy="${local_no_proxy},${no_proxy}"
  else
    no_proxy="${local_no_proxy}"
  fi

  : "${NPM_CONFIG_CACHE:=${npm_config_cache:-${DEFAULT_NPM_CACHE}}}"
  : "${npm_config_cache:=${NPM_CONFIG_CACHE}}"
  mkdir -p "${NPM_CONFIG_CACHE}" "${npm_config_cache}"

  if [[ "${DECK_GO_DATA_DIR}" != /* ]]; then
    DECK_GO_DATA_DIR="${ROOT_DIR}/${DECK_GO_DATA_DIR}"
  fi

  BACKEND_BASE="http://${DECK_GO_ADDR}"
  FRONTEND_BASE="http://${DECK_GO_FRONTEND_HOST}:${DECK_GO_FRONTEND_PORT}"
  BACKEND_PORT="${DECK_GO_ADDR##*:}"
  FRONTEND_PORT="${DECK_GO_FRONTEND_PORT}"
  CURL_AUTH_ARGS=(-H "x-deck-token: ${DECK_GO_ACCESS_TOKEN}")

  export DECK_GO_ADDR
  export DECK_GO_DATA_DIR
  export DECK_GO_ACCESS_TOKEN
  export DECK_GO_GATEWAY_AUTO_START
  export DECK_GO_FRONTEND_HOST
  export DECK_GO_FRONTEND_PORT
  export DECK_GO_RUNTIME_ACTION_TIMEOUT
  export VITE_DECK_GO_API_BASE
  export VITE_DECK_VISUAL_STATE
  export BACKEND_BASE
  export FRONTEND_BASE
  export NO_PROXY
  export no_proxy
  export NPM_CONFIG_CACHE
  export npm_config_cache

  mkdir -p "${DECK_GO_DATA_DIR}"
}

pid_running() {
  local pid_file="$1"
  if [[ ! -f "${pid_file}" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "${pid_file}")"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

listener_pid() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

port_running() {
  [[ -n "$(listener_pid "$1")" ]]
}

stop_pid() {
  local pid_file="$1"
  local label="$2"
  local port="${3:-}"
  local pid=""
  if ! pid_running "${pid_file}"; then
    if [[ -n "${port}" ]]; then
      pid="$(listener_pid "${port}")"
    fi
    if [[ -z "${pid}" ]]; then
      rm -f "${pid_file}"
      return 0
    fi
    echo "${pid}" >"${pid_file}"
  else
    pid="$(cat "${pid_file}")"
  fi
  kill "${pid}" 2>/dev/null || true
  for _ in {1..20}; do
    if [[ -n "${port}" ]]; then
      if ! port_running "${port}"; then
        rm -f "${pid_file}"
        echo "[deck-go-local] stopped ${label} (${pid})"
        return 0
      fi
    elif ! kill -0 "${pid}" 2>/dev/null; then
      rm -f "${pid_file}"
      echo "[deck-go-local] stopped ${label} (${pid})"
      return 0
    fi
    sleep 0.5
  done
  kill -9 "${pid}" 2>/dev/null || true
  for _ in {1..10}; do
    if [[ -n "${port}" ]]; then
      if ! port_running "${port}"; then
        rm -f "${pid_file}"
        echo "[deck-go-local] force-stopped ${label} (${pid})"
        return 0
      fi
    elif ! kill -0 "${pid}" 2>/dev/null; then
      rm -f "${pid_file}"
      echo "[deck-go-local] force-stopped ${label} (${pid})"
      return 0
    fi
    sleep 0.5
  done
  rm -f "${pid_file}"
  echo "[deck-go-local] failed to stop ${label} (${pid}) on port ${port:-unknown}" >&2
  return 1
}

wait_for_url() {
  local url="$1"
  local label="$2"
  shift 2
  for _ in {1..40}; do
    if curl --max-time 5 -sf "$@" "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "[deck-go-local] timed out waiting for ${label}: ${url}" >&2
  return 1
}

runtime_snapshot() {
  curl --max-time 5 -sf "${CURL_AUTH_ARGS[@]}" "${BACKEND_BASE}/api/runtime/gateway"
}

wait_for_runtime_healthy() {
  python3 - "${BACKEND_BASE}" "${DECK_GO_ACCESS_TOKEN}" <<'PY'
import json
import sys
import time
import urllib.request

base = sys.argv[1]
token = sys.argv[2]
request = urllib.request.Request(f"{base}/api/runtime/gateway", headers={"x-deck-token": token})
last = None
for _ in range(30):
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.load(response)
    runtime = payload.get("runtime", {})
    last = runtime
    if runtime.get("status") == "running" and runtime.get("health") == "healthy":
        print("[deck-go-local] runtime reached running/healthy")
        raise SystemExit(0)
    time.sleep(1)
print("[deck-go-local] runtime failed to reach running/healthy", file=sys.stderr)
print(json.dumps(last or {}, indent=2), file=sys.stderr)
raise SystemExit(1)
PY
}

wait_for_backend_autostart_runtime() {
  if [[ "${DECK_GO_GATEWAY_AUTO_START}" != "true" ]]; then
    echo "[deck-go-local] managed runtime autostart disabled"
    return 0
  fi
  echo "[deck-go-local] waiting for backend-managed Gateway autostart"
  wait_for_runtime_healthy
}

wait_for_runtime_stopped() {
  python3 - "${BACKEND_BASE}" "${DECK_GO_ACCESS_TOKEN}" <<'PY'
import json
import sys
import time
import urllib.request

base = sys.argv[1]
token = sys.argv[2]
request = urllib.request.Request(f"{base}/api/runtime/gateway", headers={"x-deck-token": token})
last = None
for _ in range(30):
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.load(response)
    runtime = payload.get("runtime", {})
    last = runtime
    if runtime.get("status") == "stopped":
        print("[deck-go-local] runtime reached stopped")
        raise SystemExit(0)
    time.sleep(1)
print("[deck-go-local] runtime failed to reach stopped", file=sys.stderr)
print(json.dumps(last or {}, indent=2), file=sys.stderr)
raise SystemExit(1)
PY
}

build_frontend() {
  echo "[deck-go-local] building frontend against ${VITE_DECK_GO_API_BASE}"
  (
    cd "${ROOT_DIR}/frontend"
    VITE_DECK_GO_API_BASE="${VITE_DECK_GO_API_BASE}" \
      VITE_DECK_VISUAL_STATE="${VITE_DECK_VISUAL_STATE}" \
      npm run build
  )
}

build_backend() {
  echo "[deck-go-local] building backend binary"
  (
    cd "${ROOT_DIR}/backend"
    if env "${GO_ENV[@]}" go build -o "${BACKEND_BIN}" ./cmd/deck-go; then
      exit 0
    fi
    echo "[deck-go-local] backend build failed; clearing temporary Go build cache and retrying" >&2
    rm -rf /tmp/deck-go-buildcache
    mkdir -p /tmp/deck-go-buildcache
    env "${GO_ENV[@]}" go build -o "${BACKEND_BIN}" ./cmd/deck-go
  )
}

start_backend() {
  if port_running "${BACKEND_PORT}" && curl -sf "${CURL_AUTH_ARGS[@]}" "${BACKEND_BASE}/api/bootstrap/status" >/dev/null 2>&1; then
    listener_pid "${BACKEND_PORT}" >"${BACKEND_PID_FILE}"
    echo "[deck-go-local] backend already running ($(cat "${BACKEND_PID_FILE}"))"
    return 0
  fi
  build_backend
  echo "[deck-go-local] starting backend on ${DECK_GO_ADDR}"
  (
    cd "${ROOT_DIR}"
    nohup env \
      DECK_GO_ADDR="${DECK_GO_ADDR}" \
      DECK_GO_DATA_DIR="${DECK_GO_DATA_DIR}" \
      DECK_GO_ACCESS_TOKEN="${DECK_GO_ACCESS_TOKEN}" \
      DECK_GO_GATEWAY_AUTO_START="${DECK_GO_GATEWAY_AUTO_START}" \
      "${BACKEND_BIN}" >"${BACKEND_LOG}" 2>&1 </dev/null &
  )
  wait_for_url "${BACKEND_BASE}/api/bootstrap/status" "deck-go backend" "${CURL_AUTH_ARGS[@]}"
  listener_pid "${BACKEND_PORT}" >"${BACKEND_PID_FILE}"
}

start_frontend() {
  if port_running "${FRONTEND_PORT}" && curl -sf "${FRONTEND_BASE}/" >/dev/null 2>&1; then
    listener_pid "${FRONTEND_PORT}" >"${FRONTEND_PID_FILE}"
    echo "[deck-go-local] frontend already running ($(cat "${FRONTEND_PID_FILE}"))"
    return 0
  fi
  echo "[deck-go-local] starting frontend preview on ${FRONTEND_BASE}"
  (
    cd "${ROOT_DIR}/frontend"
    nohup env \
      VITE_DECK_GO_API_BASE="${VITE_DECK_GO_API_BASE}" \
      VITE_DECK_VISUAL_STATE="${VITE_DECK_VISUAL_STATE}" \
      "${FRONTEND_BIN}" preview --host "${DECK_GO_FRONTEND_HOST}" --port "${DECK_GO_FRONTEND_PORT}" >"${FRONTEND_LOG}" 2>&1 </dev/null &
  )
  wait_for_url "${FRONTEND_BASE}/" "frontend preview"
  listener_pid "${FRONTEND_PORT}" >"${FRONTEND_PID_FILE}"
}

runtime_start() {
  local snapshot
  snapshot="$(runtime_snapshot 2>/dev/null || true)"
  if [[ "${snapshot}" == *'"status":"running"'* ]] && [[ "${snapshot}" == *'"health":"healthy"'* ]]; then
    echo "[deck-go-local] runtime already running/healthy"
    return 0
  fi
  if [[ "${snapshot}" == *'"status":"starting"'* ]]; then
    echo "[deck-go-local] runtime already starting; waiting for healthy"
    wait_for_runtime_healthy
    return 0
  fi
  echo "[deck-go-local] requesting managed gateway start"
  curl --max-time "${DECK_GO_RUNTIME_ACTION_TIMEOUT}" -sf -X POST "${CURL_AUTH_ARGS[@]}" "${BACKEND_BASE}/api/runtime/gateway/start" >/dev/null
  wait_for_runtime_healthy
}

runtime_stop() {
  local snapshot
  snapshot="$(runtime_snapshot 2>/dev/null || true)"
  if [[ "${snapshot}" == *'"status":"stopped"'* ]]; then
    echo "[deck-go-local] runtime already stopped"
    return 0
  fi
  echo "[deck-go-local] requesting managed gateway stop"
  curl --max-time "${DECK_GO_RUNTIME_ACTION_TIMEOUT}" -sf -X POST "${CURL_AUTH_ARGS[@]}" "${BACKEND_BASE}/api/runtime/gateway/stop" >/dev/null
  wait_for_runtime_stopped
}

show_status() {
  local backend_pid=""
  local frontend_pid=""
  backend_pid="$(listener_pid "${BACKEND_PORT}")"
  frontend_pid="$(listener_pid "${FRONTEND_PORT}")"
  echo "[deck-go-local] env file: ${ENV_FILE}"
  if [[ -n "${backend_pid}" ]]; then
    echo "[deck-go-local] backend pid: ${backend_pid}"
    echo "${backend_pid}" >"${BACKEND_PID_FILE}"
  else
    echo "[deck-go-local] backend pid: stopped"
    rm -f "${BACKEND_PID_FILE}"
  fi
  if [[ -n "${frontend_pid}" ]]; then
    echo "[deck-go-local] frontend pid: ${frontend_pid}"
    echo "${frontend_pid}" >"${FRONTEND_PID_FILE}"
  else
    echo "[deck-go-local] frontend pid: stopped"
    rm -f "${FRONTEND_PID_FILE}"
  fi
  if curl --max-time 5 -sf "${CURL_AUTH_ARGS[@]}" "${BACKEND_BASE}/api/bootstrap/status" >/dev/null 2>&1; then
    echo "[deck-go-local] bootstrap: reachable"
  else
    echo "[deck-go-local] bootstrap: unreachable"
  fi
  if curl --max-time 5 -sf "${FRONTEND_BASE}/" >/dev/null 2>&1; then
    echo "[deck-go-local] frontend: reachable"
  else
    echo "[deck-go-local] frontend: unreachable"
  fi
  if curl --max-time 5 -sf "${CURL_AUTH_ARGS[@]}" "${BACKEND_BASE}/api/runtime/gateway" >/dev/null 2>&1; then
    echo "[deck-go-local] runtime:"
    runtime_snapshot
  fi
}

tail_logs() {
  echo "[deck-go-local] backend log: ${BACKEND_LOG}"
  echo "[deck-go-local] frontend log: ${FRONTEND_LOG}"
  tail -n 80 -f "${BACKEND_LOG}" "${FRONTEND_LOG}"
}

run_backend_fg() {
  build_backend
  cd "${ROOT_DIR}"
  exec env \
    DECK_GO_ADDR="${DECK_GO_ADDR}" \
    DECK_GO_DATA_DIR="${DECK_GO_DATA_DIR}" \
    DECK_GO_ACCESS_TOKEN="${DECK_GO_ACCESS_TOKEN}" \
    DECK_GO_GATEWAY_AUTO_START="${DECK_GO_GATEWAY_AUTO_START}" \
    "${BACKEND_BIN}"
}

run_frontend_fg() {
  build_frontend
  cd "${ROOT_DIR}/frontend"
  exec env \
    VITE_DECK_GO_API_BASE="${VITE_DECK_GO_API_BASE}" \
    VITE_DECK_VISUAL_STATE="${VITE_DECK_VISUAL_STATE}" \
    "${FRONTEND_BIN}" preview --host "${DECK_GO_FRONTEND_HOST}" --port "${DECK_GO_FRONTEND_PORT}"
}

chat_smoke() {
  echo "[deck-go-local] chat-smoke is deprecated for Codex/Ralph validation" >&2
  echo "[deck-go-local] use the Codex Playwright plugin against backend-fg/frontend-fg/runtime-start instead" >&2
  return 2
}

load_env

command="${1:-}"
case "${command}" in
  start)
    build_frontend
    start_backend
    wait_for_backend_autostart_runtime
    start_frontend
    show_status
    ;;
  stop)
    stop_pid "${FRONTEND_PID_FILE}" "frontend" "${FRONTEND_PORT}"
    stop_pid "${BACKEND_PID_FILE}" "backend" "${BACKEND_PORT}"
    ;;
  restart)
    stop_pid "${FRONTEND_PID_FILE}" "frontend" "${FRONTEND_PORT}"
    stop_pid "${BACKEND_PID_FILE}" "backend" "${BACKEND_PORT}"
    build_frontend
    start_backend
    wait_for_backend_autostart_runtime
    start_frontend
    show_status
    ;;
  status)
    show_status
    ;;
  logs)
    tail_logs
    ;;
  backend-fg)
    run_backend_fg
    ;;
  frontend-fg)
    run_frontend_fg
    ;;
  runtime-start)
    runtime_start
    ;;
  runtime-stop)
    runtime_stop
    ;;
  chat-smoke)
    chat_smoke
    ;;
  *)
    usage
    exit 2
    ;;
esac
