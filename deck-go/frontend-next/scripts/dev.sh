#!/usr/bin/env bash
#
# dev.sh — openclaw-deck 开发环境管理脚本
#
# 用法:
#   ./scripts/dev.sh start     # 启动 Gateway + Dashboard
#   ./scripts/dev.sh stop      # 停止所有服务
#   ./scripts/dev.sh restart   # 重启所有服务
#   ./scripts/dev.sh status    # 查看服务状态
#   ./scripts/dev.sh gateway   # 仅启动/重启 Gateway
#   ./scripts/dev.sh dashboard # 仅启动/重启 Dashboard
#   ./scripts/dev.sh build     # 重新构建 Gateway（从源码）
#   ./scripts/dev.sh logs      # 查看 Gateway 日志（tail -f）
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DASH_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- 配置 ---
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3099}"
GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-test-token-for-e2e}"
GATEWAY_LOG="/tmp/openclaw-deck-gateway.log"
DASHBOARD_LOG="/tmp/openclaw-deck-dashboard.log"
GATEWAY_PID="/tmp/openclaw-deck-gateway.pid"
DASHBOARD_PID="/tmp/openclaw-deck-dashboard.pid"

# --- 颜色 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail()  { echo -e "${RED}[fail]${NC}  $*"; }

# --- 进程管理 ---

is_running() {
  local pidfile="$1"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pidfile"
  fi
  return 1
}

stop_service() {
  local name="$1" pidfile="$2"
  if is_running "$pidfile"; then
    local pid
    pid=$(cat "$pidfile")
    info "停止 $name (PID $pid)..."
    kill "$pid" 2>/dev/null || true
    # 等待最多 5 秒
    for _ in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    # 强制终止
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
    ok "$name 已停止"
  else
    info "$name 未运行"
  fi
}

# --- Gateway ---

build_gateway() {
  info "构建 Gateway（从源码）..."
  (cd "$REPO_ROOT" && pnpm build 2>&1 | tail -5)
  ok "Gateway 构建完成 ($(cat "$REPO_ROOT/package.json" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])"))"
}

start_gateway() {
  if is_running "$GATEWAY_PID"; then
    warn "Gateway 已在运行 (PID $(cat "$GATEWAY_PID"))"
    return
  fi

  # 检查构建产物
  if [[ ! -f "$REPO_ROOT/dist/entry.js" ]]; then
    warn "未检测到构建产物，先构建..."
    build_gateway
  fi

  info "启动 Gateway (端口 $GATEWAY_PORT)..."
  OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
    nohup node "$REPO_ROOT/openclaw.mjs" gateway run \
      --port "$GATEWAY_PORT" \
      --bind loopback \
      --allow-unconfigured \
      --force \
      > "$GATEWAY_LOG" 2>&1 &
  echo $! > "$GATEWAY_PID"

  # 等待 Gateway 就绪
  for i in $(seq 1 20); do
    if NO_PROXY="*" curl -sf "http://127.0.0.1:$GATEWAY_PORT" >/dev/null 2>&1; then
      ok "Gateway 已启动 (PID $(cat "$GATEWAY_PID"), 端口 $GATEWAY_PORT)"
      return
    fi
    sleep 0.5
  done

  # WebSocket gateway 不会响应 HTTP GET，换个方式检测
  if is_running "$GATEWAY_PID"; then
    ok "Gateway 进程已启动 (PID $(cat "$GATEWAY_PID"), 端口 $GATEWAY_PORT)"
    info "日志: tail -f $GATEWAY_LOG"
  else
    fail "Gateway 启动失败，查看日志: $GATEWAY_LOG"
    tail -20 "$GATEWAY_LOG"
    return 1
  fi
}

# --- Dashboard ---

start_dashboard() {
  if is_running "$DASHBOARD_PID"; then
    warn "Dashboard 已在运行 (PID $(cat "$DASHBOARD_PID"))"
    return
  fi

  info "启动 Dashboard (端口 $DASHBOARD_PORT)..."
  (cd "$DASH_ROOT" && \
    nohup npx next dev --port "$DASHBOARD_PORT" \
      > "$DASHBOARD_LOG" 2>&1 &
    echo $! > "$DASHBOARD_PID"
  )

  # 等待 Dashboard 就绪
  for i in $(seq 1 30); do
    if NO_PROXY="*" curl -sf "http://127.0.0.1:$DASHBOARD_PORT" >/dev/null 2>&1; then
      ok "Dashboard 已启动 (PID $(cat "$DASHBOARD_PID"), 端口 $DASHBOARD_PORT)"
      info "打开 http://localhost:$DASHBOARD_PORT"
      return
    fi
    sleep 1
  done

  if is_running "$DASHBOARD_PID"; then
    ok "Dashboard 进程已启动 (PID $(cat "$DASHBOARD_PID"), 端口 $DASHBOARD_PORT)"
    info "首次编译可能需要更长时间，请稍等..."
    info "日志: tail -f $DASHBOARD_LOG"
  else
    fail "Dashboard 启动失败，查看日志: $DASHBOARD_LOG"
    tail -20 "$DASHBOARD_LOG"
    return 1
  fi
}

# --- 状态 ---

show_status() {
  echo ""
  echo "  openclaw-deck 开发环境"
  echo "  ─────────────────────────"

  if is_running "$GATEWAY_PID"; then
    local gpid
    gpid=$(cat "$GATEWAY_PID")
    ok "Gateway    PID=$gpid  端口=$GATEWAY_PORT  (源码构建)"
  else
    fail "Gateway    未运行"
  fi

  if is_running "$DASHBOARD_PID"; then
    local dpid
    dpid=$(cat "$DASHBOARD_PID")
    ok "Dashboard  PID=$dpid  端口=$DASHBOARD_PORT"
  else
    fail "Dashboard  未运行"
  fi

  echo ""
  info "Gateway 日志:   tail -f $GATEWAY_LOG"
  info "Dashboard 日志: tail -f $DASHBOARD_LOG"
  echo ""
}

# --- 主入口 ---

case "${1:-help}" in
  start)
    start_gateway
    start_dashboard
    echo ""
    show_status
    ;;
  stop)
    stop_service "Dashboard" "$DASHBOARD_PID"
    stop_service "Gateway" "$GATEWAY_PID"
    # 清理残留进程
    pkill -f "openclaw.mjs.*gateway" 2>/dev/null || true
    pkill -f "next dev --port $DASHBOARD_PORT" 2>/dev/null || true
    ;;
  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;
  status)
    show_status
    ;;
  gateway)
    stop_service "Gateway" "$GATEWAY_PID"
    pkill -f "openclaw.mjs.*gateway" 2>/dev/null || true
    sleep 1
    start_gateway
    ;;
  dashboard)
    stop_service "Dashboard" "$DASHBOARD_PID"
    pkill -f "next dev --port $DASHBOARD_PORT" 2>/dev/null || true
    sleep 1
    start_dashboard
    ;;
  build)
    build_gateway
    ;;
  logs)
    tail -f "$GATEWAY_LOG"
    ;;
  help|--help|-h)
    echo "用法: $0 {start|stop|restart|status|gateway|dashboard|build|logs}"
    echo ""
    echo "  start      启动 Gateway + Dashboard"
    echo "  stop       停止所有服务"
    echo "  restart    重启所有服务"
    echo "  status     查看服务状态"
    echo "  gateway    仅启动/重启 Gateway"
    echo "  dashboard  仅启动/重启 Dashboard"
    echo "  build      重新构建 Gateway（从源码）"
    echo "  logs       查看 Gateway 日志"
    echo ""
    echo "环境变量:"
    echo "  GATEWAY_PORT              Gateway 端口 (默认 $GATEWAY_PORT)"
    echo "  DASHBOARD_PORT            Dashboard 端口 (默认 $DASHBOARD_PORT)"
    echo "  OPENCLAW_GATEWAY_TOKEN    Gateway 认证 token (默认 test-token-for-e2e)"
    ;;
  *)
    fail "未知命令: $1"
    "$0" help
    exit 1
    ;;
esac
