#!/usr/bin/env bash
#
# run-stack-real.sh — 一键启 deck-go + 真实 OpenClaw Gateway + Vite dev server（全栈 dev/E2E 用）。
#
# 与 manage-local-stack.sh（默认 mock Gateway）正交：本脚本只走真 Gateway 路径，
# 保留 mock 体系不动；前后端绑定固定端口（18789/19566/4174），启动前先清理占用。
#
# 用法：
#   scripts/dev/run-stack-real.sh start    # 启 backend + 真 Gateway + Vite dev server
#   scripts/dev/run-stack-real.sh stop     # 停所有服务，清端口
#   scripts/dev/run-stack-real.sh restart  # stop + start
#   scripts/dev/run-stack-real.sh status   # 检查端口/PID
#   scripts/dev/run-stack-real.sh logs     # tail 后台日志
#
# 环境覆盖优先级：DECK_GO_STACK_ENV 指向的 .env 文件 > 进程 env > 内置默认。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK_GO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPO_ROOT="$(cd "${DECK_GO_DIR}/.." && pwd)"
ENV_FILE="${DECK_GO_STACK_ENV:-${DECK_GO_DIR}/.env.real-stack}"

STATE_DIR="${DECK_GO_DIR}/.local/deck-go-real-stack"
PID_DIR="${STATE_DIR}/pids"
LOG_DIR="${STATE_DIR}/logs"
BIN_DIR="${STATE_DIR}/bin"
BACKEND_PID_FILE="${PID_DIR}/backend.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend.pid"
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
BACKEND_BIN="${BIN_DIR}/deck-go"
FRONTEND_DIR="${DECK_GO_DIR}/frontend-new"
FRONTEND_BIN="${FRONTEND_DIR}/node_modules/.bin/vite"

GO_ENV=(
  GOCACHE=/tmp/deck-go-buildcache
  GOSUMDB=off
)
DEFAULT_NPM_CACHE="/tmp/deck-go-npm-cache"

mkdir -p "${PID_DIR}" "${LOG_DIR}" "${BIN_DIR}"

usage() {
  cat <<'EOF'
usage: deck-go/scripts/dev/run-stack-real.sh <command>

commands:
  start    启 backend + 真 Gateway（由 deck-go 自动 spawn）+ Vite dev server
  stop     停 backend + Vite，清 18789/19566/4174 端口
  restart  stop 后再 start
  status   显示进程和端口状态
  logs     tail backend/frontend 日志

env file:
  默认读 deck-go/.env.real-stack；用 DECK_GO_STACK_ENV 覆盖路径。
  可参考 deck-go/.env.real-stack.example。
  前端默认 DECK_GO_FRONTEND_MODE=dev；如需验证构建产物，设为 preview。
EOF
}

load_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
  else
    echo "[real-stack] env file not found: ${ENV_FILE}" >&2
    echo "[real-stack] using built-in defaults; copy .env.real-stack.example to override." >&2
  fi

  : "${DECK_GO_ADDR:=127.0.0.1:19566}"
  : "${DECK_GO_DATA_DIR:=${STATE_DIR}/data}"
  : "${DECK_GO_ACCESS_TOKEN:=real-stack-deck-token}"
  : "${DECK_GO_FRONTEND_HOST:=127.0.0.1}"
  : "${DECK_GO_FRONTEND_PORT:=4174}"
  : "${DECK_GO_FRONTEND_MODE:=dev}"
  if [[ "${DECK_GO_FRONTEND_MODE}" != "dev" && "${DECK_GO_FRONTEND_MODE}" != "preview" ]]; then
    echo "[real-stack] DECK_GO_FRONTEND_MODE must be dev or preview, got ${DECK_GO_FRONTEND_MODE}" >&2
    exit 1
  fi
  : "${VITE_DECK_GO_API_BASE:=http://${DECK_GO_ADDR}}"
  : "${VITE_DECK_VISUAL_STATE:=1}"
  # Auto-unlock: expose the deck access token to Vite so the browser bypasses
  # the manual auth gate. Only safe for local dev/E2E.
  : "${VITE_DECK_GO_ACCESS_TOKEN:=${DECK_GO_ACCESS_TOKEN}}"
  : "${VITE_DECK_GO_AUTO_UNLOCK:=1}"

  : "${RUNTIME_MODE:=bundled}"
  if [[ "${RUNTIME_MODE}" != "bundled" ]]; then
    echo "[real-stack] this script only supports RUNTIME_MODE=bundled (got ${RUNTIME_MODE})" >&2
    exit 1
  fi

  : "${RUNTIME_BUNDLED_COMMAND:=pnpm}"
  : "${RUNTIME_BUNDLED_ARGS:=openclaw gateway run --bind loopback --port 18789 --allow-unconfigured}"
  : "${RUNTIME_BUNDLED_WORKDIR:=${REPO_ROOT}}"
  : "${RUNTIME_BUNDLED_BIND_HOST:=127.0.0.1}"
  : "${RUNTIME_BUNDLED_BIND_PORT:=18789}"
  : "${RUNTIME_BUNDLED_TOKEN:=real-stack-gateway-token}"
  : "${RUNTIME_BUNDLED_AUTO_START:=true}"
  : "${RUNTIME_BUNDLED_ENV_NO_PROXY:=localhost,127.0.0.1,::1}"

  if [[ "${DECK_GO_DATA_DIR}" != /* ]]; then
    DECK_GO_DATA_DIR="${DECK_GO_DIR}/${DECK_GO_DATA_DIR}"
  fi
  : "${RUNTIME_ADMIN_SOCKET:=${DECK_GO_DATA_DIR}/admin.sock}"

  local local_no_proxy="localhost,127.0.0.1,::1"
  NO_PROXY="${NO_PROXY:+${NO_PROXY},}${local_no_proxy}"
  no_proxy="${no_proxy:+${no_proxy},}${local_no_proxy}"

  : "${NPM_CONFIG_CACHE:=${npm_config_cache:-${DEFAULT_NPM_CACHE}}}"
  : "${npm_config_cache:=${NPM_CONFIG_CACHE}}"
  mkdir -p "${NPM_CONFIG_CACHE}" "${DECK_GO_DATA_DIR}"

  BACKEND_BASE="http://${DECK_GO_ADDR}"
  FRONTEND_BASE="http://${DECK_GO_FRONTEND_HOST}:${DECK_GO_FRONTEND_PORT}"
  BACKEND_PORT="${DECK_GO_ADDR##*:}"
  FRONTEND_PORT="${DECK_GO_FRONTEND_PORT}"

  export DECK_GO_ADDR DECK_GO_DATA_DIR DECK_GO_ACCESS_TOKEN
  export DECK_GO_FRONTEND_HOST DECK_GO_FRONTEND_PORT DECK_GO_FRONTEND_MODE
  export VITE_DECK_GO_API_BASE VITE_DECK_VISUAL_STATE
  export VITE_DECK_GO_ACCESS_TOKEN VITE_DECK_GO_AUTO_UNLOCK
  export RUNTIME_MODE RUNTIME_BUNDLED_COMMAND RUNTIME_BUNDLED_ARGS RUNTIME_BUNDLED_WORKDIR
  export RUNTIME_BUNDLED_BIND_HOST RUNTIME_BUNDLED_BIND_PORT RUNTIME_BUNDLED_TOKEN
  export RUNTIME_BUNDLED_AUTO_START RUNTIME_BUNDLED_ENV_NO_PROXY
  export RUNTIME_ADMIN_SOCKET NO_PROXY no_proxy NPM_CONFIG_CACHE npm_config_cache
}

listener_pid() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

launch_detached() {
  local pid_file="$1"
  local log_file="$2"
  local cwd="$3"
  shift 3
  rm -f "${pid_file}"
  python3 - "${pid_file}" "${log_file}" "${cwd}" "$@" <<'PY'
import os
import subprocess
import sys

pid_file, log_file, cwd, *command = sys.argv[1:]
os.makedirs(os.path.dirname(pid_file), exist_ok=True)
os.makedirs(os.path.dirname(log_file), exist_ok=True)
with open(log_file, "ab", buffering=0) as log:
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env=os.environ.copy(),
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        close_fds=True,
        start_new_session=True,
    )
with open(pid_file, "w", encoding="utf-8") as handle:
    handle.write(str(process.pid))
PY
  for _ in {1..30}; do
    if [[ -s "${pid_file}" ]] && kill -0 "$(cat "${pid_file}")" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
  done
  echo "[real-stack] failed to launch detached process: $*" >&2
  return 1
}

curl_local() {
  curl --noproxy '*' "$@"
}

gateway_listener_kind() {
  local body
  body="$(curl_local -sS -m 2 "http://${RUNTIME_BUNDLED_BIND_HOST}:${RUNTIME_BUNDLED_BIND_PORT}/" 2>/dev/null || true)"
  if grep -qi "mock gateway only serves" <<<"${body}"; then
    echo "mock"
  elif grep -Eqi "(OpenClaw|<!doctype html|<html)" <<<"${body}"; then
    echo "real"
  elif [[ -n "${body}" ]]; then
    echo "unknown"
  else
    echo "unresponsive"
  fi
}

kill_port() {
  local port="$1"
  local pid
  pid="$(listener_pid "${port}")"
  if [[ -n "${pid}" ]]; then
    echo "[real-stack] killing PID ${pid} on port ${port}"
    kill "${pid}" 2>/dev/null || true
    for _ in {1..20}; do
      if [[ -z "$(listener_pid "${port}")" ]]; then return 0; fi
      sleep 0.5
    done
    kill -9 "${pid}" 2>/dev/null || true
    sleep 0.5
  fi
}

cleanup_ports() {
  for port in "${BACKEND_PORT}" "${RUNTIME_BUNDLED_BIND_PORT}" "${FRONTEND_PORT}"; do
    kill_port "${port}"
  done
}

build_backend() {
  echo "[real-stack] building deck-go binary..."
  (
    cd "${DECK_GO_DIR}/backend"
    if env "${GO_ENV[@]}" go build -o "${BACKEND_BIN}" ./cmd/deck-go; then
      exit 0
    fi
    echo "[real-stack] backend build failed; clearing temporary Go caches and retrying" >&2
    rm -rf /tmp/deck-go-buildcache /tmp/deck-go-gomodcache /tmp/deck-go-gopath
    mkdir -p /tmp/deck-go-buildcache
    env "${GO_ENV[@]}" go build -o "${BACKEND_BIN}" ./cmd/deck-go
  )
}

build_frontend() {
  echo "[real-stack] building frontend..."
  ( cd "${FRONTEND_DIR}" \
      && npm_config_cache="${NPM_CONFIG_CACHE}" npm install --no-audit --no-fund --silent \
      && npm_config_cache="${NPM_CONFIG_CACHE}" npm run build )
}

ensure_frontend_deps() {
  if [[ -x "${FRONTEND_BIN}" ]]; then
    return 0
  fi
  echo "[real-stack] installing frontend dependencies..."
  ( cd "${FRONTEND_DIR}" && npm_config_cache="${NPM_CONFIG_CACHE}" npm install --no-audit --no-fund --silent )
}

prepare_frontend() {
  if [[ "${DECK_GO_FRONTEND_MODE}" == "preview" ]]; then
    build_frontend
    return 0
  fi
  ensure_frontend_deps
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local timeout="${3:-60}"
  for _ in $(seq 1 "${timeout}"); do
    if curl_local -sSfL -m 1 "${url}" >/dev/null 2>&1 \
       || curl_local -sSfL -m 1 -H "x-deck-token: ${DECK_GO_ACCESS_TOKEN}" "${url}" >/dev/null 2>&1; then
      return 0
    fi
    if [[ -s "${BACKEND_LOG}" ]] && grep -qE "(EADDRINUSE|exit 64|panic|fatal)" "${BACKEND_LOG}" 2>/dev/null; then
      echo "[real-stack] ${label} startup error detected; tail of log:" >&2
      tail -n 30 "${BACKEND_LOG}" >&2
      return 1
    fi
    sleep 1
  done
  echo "[real-stack] ${label} did not respond at ${url} within ${timeout}s" >&2
  return 1
}

wait_for_gateway_ready() {
  local timeout="${1:-180}"
  local last_error="not checked yet"
  echo "[real-stack] waiting for real Gateway readiness through deck-go..."
  for _ in $(seq 1 "${timeout}"); do
    local kind
    kind="$(gateway_listener_kind)"
    if [[ "${kind}" == "mock" ]]; then
      echo "[real-stack] Gateway port ${RUNTIME_BUNDLED_BIND_PORT} is a mock Gateway, not the real Gateway" >&2
      return 1
    fi

    local runtime_body=""
    if runtime_body="$(curl_local -sSfL -m 3 -H "x-deck-token: ${DECK_GO_ACCESS_TOKEN}" "${BACKEND_BASE}/api/runtime/gateway" 2>/dev/null)"; then
      if grep -q '"mode":"bundled"' <<<"${runtime_body}" && grep -q '"pid":' <<<"${runtime_body}"; then
        local health_body=""
        if health_body="$(curl_local -sSfL -m 5 -H "x-deck-token: ${DECK_GO_ACCESS_TOKEN}" "${BACKEND_BASE}/api/gateway/health" 2>/dev/null)"; then
          if grep -q '"ok":false' <<<"${health_body}"; then
            last_error="gateway health reported ok=false: ${health_body}"
          else
            local rpc_body=""
            if rpc_body="$(curl_local -sSfL -m 5 \
              -H "x-deck-token: ${DECK_GO_ACCESS_TOKEN}" \
              -H "Content-Type: application/json" \
              --data '{"method":"agents.list","params":{}}' \
              "${BACKEND_BASE}/api/v1/runtimes/rt_local/gateway/rpc" 2>/dev/null)"; then
              if grep -q '"agents":' <<<"${rpc_body}"; then
                echo "[real-stack] real Gateway ready (pid from runtime: ${runtime_body})"
                return 0
              fi
              last_error="agents.list response missing agents: ${rpc_body}"
            else
              last_error="agents.list RPC not ready"
            fi
          fi
        else
          last_error="gateway health not ready"
        fi
      else
        last_error="runtime is not bundled with a pid yet: ${runtime_body}"
      fi
    else
      last_error="runtime gateway endpoint not ready"
    fi

    if [[ -s "${BACKEND_LOG}" ]] && grep -qE "(EADDRINUSE|exit 64|panic|fatal)" "${BACKEND_LOG}" 2>/dev/null; then
      echo "[real-stack] Gateway startup error detected; tail of backend log:" >&2
      tail -n 60 "${BACKEND_LOG}" >&2
      return 1
    fi
    sleep 1
  done
  echo "[real-stack] real Gateway did not become ready within ${timeout}s: ${last_error}" >&2
  tail -n 80 "${BACKEND_LOG}" >&2 || true
  return 1
}

start_backend() {
  if [[ -s "${BACKEND_PID_FILE}" ]] && kill -0 "$(cat "${BACKEND_PID_FILE}")" 2>/dev/null; then
    echo "[real-stack] backend already running (pid $(cat "${BACKEND_PID_FILE}"))"
    return 0
  fi
  echo "[real-stack] launching backend (deck-go will spawn the real Gateway via supervisor)..."
  : > "${BACKEND_LOG}"
  launch_detached "${BACKEND_PID_FILE}" "${BACKEND_LOG}" "${DECK_GO_DIR}" "${BACKEND_BIN}"
  wait_for_http "${BACKEND_BASE}/healthz" "backend" 90 || {
    echo "[real-stack] backend failed to start; tail:" >&2
    tail -n 60 "${BACKEND_LOG}" >&2
    return 1
  }
  echo "[real-stack] backend ready at ${BACKEND_BASE}"
}

start_frontend() {
  if [[ -s "${FRONTEND_PID_FILE}" ]] && kill -0 "$(cat "${FRONTEND_PID_FILE}")" 2>/dev/null; then
    echo "[real-stack] frontend already running (pid $(cat "${FRONTEND_PID_FILE}"))"
    return 0
  fi
  : > "${FRONTEND_LOG}"
  echo "[real-stack] launching Vite ${DECK_GO_FRONTEND_MODE} server at ${FRONTEND_BASE}..."
  local vite_args=()
  if [[ "${DECK_GO_FRONTEND_MODE}" == "preview" ]]; then
    vite_args=(preview --host "${DECK_GO_FRONTEND_HOST}" --port "${DECK_GO_FRONTEND_PORT}" --strictPort)
  else
    vite_args=(--host "${DECK_GO_FRONTEND_HOST}" --port "${DECK_GO_FRONTEND_PORT}" --strictPort)
  fi
  launch_detached \
    "${FRONTEND_PID_FILE}" \
    "${FRONTEND_LOG}" \
    "${FRONTEND_DIR}" \
    "${FRONTEND_BIN}" \
    "${vite_args[@]}"
  wait_for_http "${FRONTEND_BASE}" "frontend" 30 || {
    echo "[real-stack] frontend failed to start; tail:" >&2
    tail -n 60 "${FRONTEND_LOG}" >&2
    return 1
  }
  echo "[real-stack] frontend ready at ${FRONTEND_BASE}"
}

verify_stack_post_start() {
  local missing=0
  for label_port in "backend:${BACKEND_PORT}" "gateway:${RUNTIME_BUNDLED_BIND_PORT}" "frontend:${FRONTEND_PORT}"; do
    local label="${label_port%:*}"
    local port="${label_port#*:}"
    local pid
    pid="$(listener_pid "${port}")"
    if [[ -z "${pid}" ]]; then
      echo "[real-stack] ${label} port ${port} has no listener after startup" >&2
      missing=1
    fi
  done
  if [[ "${missing}" != "0" ]]; then
    return 1
  fi
  wait_for_gateway_ready 10
}

cmd_start() {
  cleanup_ports
  build_backend
  prepare_frontend
  start_backend
  wait_for_gateway_ready
  start_frontend
  verify_stack_post_start

  cat <<EOF

[real-stack] ✅ all services up:
  backend       ${BACKEND_BASE}
  frontend      ${FRONTEND_BASE} (${DECK_GO_FRONTEND_MODE})
  Gateway       ws://${RUNTIME_BUNDLED_BIND_HOST}:${RUNTIME_BUNDLED_BIND_PORT}
  deck token    ${DECK_GO_ACCESS_TOKEN}
  gateway token ${RUNTIME_BUNDLED_TOKEN}
  state dir     ${DECK_GO_DATA_DIR}
  admin socket  ${RUNTIME_ADMIN_SOCKET}
  logs          ${BACKEND_LOG} | ${FRONTEND_LOG}

EOF
}

cmd_stop() {
  for f in "${FRONTEND_PID_FILE}" "${BACKEND_PID_FILE}"; do
    if [[ -s "${f}" ]]; then
      local pid
      pid="$(cat "${f}")"
      if kill -0 "${pid}" 2>/dev/null; then
        kill "${pid}" 2>/dev/null || true
        for _ in {1..20}; do
          kill -0 "${pid}" 2>/dev/null || break
          sleep 0.5
        done
        kill -9 "${pid}" 2>/dev/null || true
      fi
      rm -f "${f}"
    fi
  done
  cleanup_ports
  echo "[real-stack] stopped."
}

cmd_status() {
  for label_port in "backend:${BACKEND_PORT}" "gateway:${RUNTIME_BUNDLED_BIND_PORT}" "frontend:${FRONTEND_PORT}"; do
    local label="${label_port%:*}"
    local port="${label_port#*:}"
    local pid
    pid="$(listener_pid "${port}")"
    if [[ -n "${pid}" ]]; then
      if [[ "${label}" == "gateway" ]]; then
        echo "[real-stack] ${label} (port ${port}) — pid ${pid} [$(gateway_listener_kind)]"
      else
        echo "[real-stack] ${label} (port ${port}) — pid ${pid}"
      fi
    else
      echo "[real-stack] ${label} (port ${port}) — DOWN"
    fi
  done
}

cmd_logs() {
  echo "[real-stack] tailing ${BACKEND_LOG} and ${FRONTEND_LOG} (Ctrl-C to stop)"
  tail -F "${BACKEND_LOG}" "${FRONTEND_LOG}" 2>/dev/null
}

main() {
  local cmd="${1:-}"
  if [[ -z "${cmd}" || "${cmd}" == "-h" || "${cmd}" == "--help" ]]; then
    usage
    exit 0
  fi
  load_env
  case "${cmd}" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_stop; cmd_start ;;
    status)  cmd_status ;;
    logs)    cmd_logs ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
