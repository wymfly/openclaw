# OpenClaw + Deck 部署方案实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为增强 fork 创建完整的 Docker + 裸机部署基础设施，包含预置配置种子层、Deck Dockerfile、docker-compose 编排、systemd units 和一键部署脚本。

**Architecture:** `deploy/` 目录作为部署根，包含 seed layer（可定制预配置）、Docker 编排（Gateway + Deck 双容器）、裸机 systemd units、统一 setup.sh 入口。Gateway 复用仓库现有 Dockerfile 源码构建，Deck 新建独立 Dockerfile（Next.js standalone）。

**Tech Stack:** Docker / Docker Compose V2 / Next.js 16 standalone / systemd / bash / envsubst

**Design Spec:** `docs/superpowers/specs/2026-03-27-deploy-gateway-deck-design.md`

---

### Task 1: 创建 deploy 目录骨架和 .env.example

**Files:**

- Create: `deploy/.env.example`
- Create: `deploy/seed/README.md`

- [ ] **Step 1: 创建 deploy 目录结构**

```bash
mkdir -p deploy/seed/agents/main/agent
mkdir -p deploy/seed/cron
mkdir -p deploy/scripts
mkdir -p deploy/bare-metal
```

- [ ] **Step 2: 创建 .env.example**

Create `deploy/.env.example`:

```bash
# ============================================================
# OpenClaw + Deck 部署环境变量
# 复制为 .env 后编辑
# ============================================================

# === 必填：AI Provider API Keys（至少配一个） ===
DEEPSEEK_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# === 自动生成（setup.sh 会填充，也可手动指定） ===
OPENCLAW_GATEWAY_TOKEN=

# === 可选 ===
# 默认模型（provider/model-id 格式）
DEFAULT_MODEL=deepseek/deepseek-chat

# 端口
GATEWAY_PORT=18789
DECK_PORT=3000

# 时区
TZ=Asia/Shanghai

# Gateway 数据目录（Docker 模式挂载路径）
OPENCLAW_STATE_DIR=./data/gateway

# Deck 数据目录（Docker 模式挂载路径）
DECK_DATA_DIR=./data/deck

# Sandbox（设为 1 启用 agent 执行隔离）
OPENCLAW_SANDBOX=
# Docker socket group ID（sandbox 需要，运行: stat -c '%g' /var/run/docker.sock）
DOCKER_GID=999

# 频道 Token（按需填写）
TELEGRAM_BOT_TOKEN=
DISCORD_BOT_TOKEN=

# 额外的 apt 包（Docker 模式，空格分隔）
OPENCLAW_DOCKER_APT_PACKAGES=python3 python3-pip ripgrep jq wget
```

- [ ] **Step 3: 创建 seed/README.md**

Create `deploy/seed/README.md`:

```markdown
# Seed Layer — 预置配置种子

本目录包含部署时自动注入的预配置数据。

## 目录结构
```

seed/
├── openclaw.json.tmpl # 主配置模板（envsubst 渲染）
├── agents/ # 预置 agent 定义
│ └── main/ # 主 agent
├── cron/ # 预置定时任务
│ └── jobs.json
└── README.md # 本文件

```

## 种子策略

| 策略 | 行为 | 适用内容 |
|------|------|----------|
| init-once | 仅首次部署写入，用户修改后不覆盖 | openclaw.json, agents/, cron/ |
| always-sync | 每次升级覆盖 | skills/, extensions/ |
| never-seed | 运行时生成 | devices/, logs/, sessions/, deck.db |

## 定制方式

1. 编辑 `openclaw.json.tmpl` 添加/修改 provider 和 model
2. 在 `agents/` 下新建目录添加预置 agent
3. 编辑 `cron/jobs.json` 添加预置定时任务
4. 运行 `../scripts/setup.sh` 重新部署

## 模板变量

`openclaw.json.tmpl` 中的 `${VAR_NAME}` 占位符在部署时由 `.env` 文件中的值替换。
使用 `${VAR:-default}` 语法设置默认值。
```

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): scaffold deploy directory with .env.example and seed README" deploy/.env.example deploy/seed/README.md
```

---

### Task 2: 创建种子配置模板

**Files:**

- Create: `deploy/seed/openclaw.json.tmpl`
- Create: `deploy/seed/agents/main/IDENTITY.md`
- Create: `deploy/seed/agents/main/agent/models.json`
- Create: `deploy/seed/cron/jobs.json`

- [ ] **Step 1: 创建 openclaw.json.tmpl**

Create `deploy/seed/openclaw.json.tmpl`。从当前 `~/.openclaw/openclaw.json` 导出结构，将敏感值替换为 `${ENV}` 占位符，保留预置 models/agents：

```json
{
  "models": {
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com",
        "apiKey": "${DEEPSEEK_API_KEY}",
        "models": [
          {
            "id": "deepseek-chat",
            "name": "DeepSeek V3",
            "contextWindow": 131072,
            "maxTokens": 8192,
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
          },
          {
            "id": "deepseek-reasoner",
            "name": "DeepSeek R1",
            "reasoning": true,
            "contextWindow": 131072,
            "maxTokens": 8192,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "${DEFAULT_MODEL}"
      }
    },
    "list": [
      {
        "id": "main"
      }
    ]
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": true
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    }
  }
}
```

Note: `$` in JSON 值中不会与 JSON 语法冲突。`seed.sh` 使用 `envsubst` 时只替换已定义的 `${VAR}` 变量，未定义的保留原文。

- [ ] **Step 2: 创建 main agent IDENTITY.md**

Create `deploy/seed/agents/main/IDENTITY.md`:

```markdown
# Main Agent Identity

I am the main assistant agent. I help users with tasks by leveraging tools and knowledge.
```

- [ ] **Step 3: 创建 main agent models.json**

Create `deploy/seed/agents/main/agent/models.json`:

```json
{}
```

- [ ] **Step 4: 创建预置 cron jobs**

Create `deploy/seed/cron/jobs.json`:

```json
{ "jobs": [] }
```

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add seed config template and preset agents" deploy/seed/openclaw.json.tmpl deploy/seed/agents/ deploy/seed/cron/jobs.json
```

---

### Task 3: 创建 seed.sh 种子注入脚本

**Files:**

- Create: `deploy/scripts/seed.sh`

- [ ] **Step 1: 创建 seed.sh**

Create `deploy/scripts/seed.sh`:

```bash
#!/usr/bin/env bash
#
# seed.sh — Inject seed data into the target OpenClaw state directory.
#
# Usage:
#   deploy/scripts/seed.sh <target-dir> [--force]
#
# Env vars read from the environment (typically loaded from .env by setup.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_DIR="$(cd "$SCRIPT_DIR/../seed" && pwd)"
TARGET_DIR="${1:?Usage: seed.sh <target-dir> [--force]}"
FORCE="${2:-}"

MARKER="$TARGET_DIR/.seed-initialized"

log() { echo "[seed] $*"; }

# ---------------------------------------------------------------------------
# envsubst wrapper — only substitute defined variables
# ---------------------------------------------------------------------------
render_template() {
  local src="$1" dst="$2"
  # Build envsubst variable list from what's actually set
  local vars=""
  for var in DEEPSEEK_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY \
             OPENCLAW_GATEWAY_TOKEN DEFAULT_MODEL \
             TELEGRAM_BOT_TOKEN DISCORD_BOT_TOKEN; do
    if [ -n "${!var:-}" ]; then
      vars="$vars \${$var}"
    fi
  done

  if [ -n "$vars" ]; then
    envsubst "$vars" < "$src" > "$dst"
  else
    cp "$src" "$dst"
  fi
}

# ---------------------------------------------------------------------------
# init-once: copy only if target does not exist
# ---------------------------------------------------------------------------
seed_init_once() {
  local src="$1" dst="$2"
  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    log "skip (exists): $dst"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  if [[ "$src" == *.tmpl ]]; then
    local dst_no_tmpl="${dst%.tmpl}"
    render_template "$src" "$dst_no_tmpl"
    log "rendered: $dst_no_tmpl"
  else
    cp -a "$src" "$dst"
    log "copied: $dst"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

mkdir -p "$TARGET_DIR"

if [ -f "$MARKER" ] && [ "$FORCE" != "--force" ]; then
  log "Target already initialized ($(cat "$MARKER")). Use --force to re-seed."
  log "Skipping init-once files, only syncing always-sync content."
else
  log "Initializing $TARGET_DIR from seed..."

  # 1. Main config (init-once, template)
  seed_init_once "$SEED_DIR/openclaw.json.tmpl" "$TARGET_DIR/openclaw.json.tmpl"

  # 2. Agents (init-once, directory copy)
  if [ -d "$SEED_DIR/agents" ]; then
    for agent_dir in "$SEED_DIR/agents"/*/; do
      agent_name="$(basename "$agent_dir")"
      if [ ! -d "$TARGET_DIR/agents/$agent_name" ] || [ "$FORCE" = "--force" ]; then
        mkdir -p "$TARGET_DIR/agents/$agent_name"
        cp -a "$agent_dir"* "$TARGET_DIR/agents/$agent_name/" 2>/dev/null || true
        log "seeded agent: $agent_name"
      else
        log "skip agent (exists): $agent_name"
      fi
    done
  fi

  # 3. Cron (init-once)
  if [ -d "$SEED_DIR/cron" ]; then
    mkdir -p "$TARGET_DIR/cron"
    seed_init_once "$SEED_DIR/cron/jobs.json" "$TARGET_DIR/cron/jobs.json"
  fi

  # Write marker
  echo "v1 $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MARKER"
  log "Seed marker written: $MARKER"
fi

log "Seed injection complete."
```

- [ ] **Step 2: 设为可执行**

```bash
chmod +x deploy/scripts/seed.sh
```

- [ ] **Step 3: 本地测试 seed.sh**

```bash
# 在临时目录测试
export OPENCLAW_GATEWAY_TOKEN=test-token-123
export DEFAULT_MODEL=deepseek/deepseek-chat
deploy/scripts/seed.sh /tmp/test-openclaw-seed

# 验证
cat /tmp/test-openclaw-seed/openclaw.json  # token 应已替换
ls /tmp/test-openclaw-seed/agents/main/    # IDENTITY.md 应存在
cat /tmp/test-openclaw-seed/.seed-initialized  # 标记应存在

# 再次运行应跳过
deploy/scripts/seed.sh /tmp/test-openclaw-seed
# 应输出 "already initialized" + "Skipping init-once files"

# 清理
rm -rf /tmp/test-openclaw-seed
```

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add seed.sh injection script with init-once strategy" deploy/scripts/seed.sh
```

---

### Task 4: 创建 Deck Dockerfile

**Files:**

- Create: `deploy/Dockerfile.deck`

- [ ] **Step 1: 创建 Dockerfile.deck**

Create `deploy/Dockerfile.deck`:

```dockerfile
# syntax=docker/dockerfile:1.7
#
# Dockerfile for openclaw-deck (Next.js standalone dashboard).
# Build context: repository root.
#
# Usage:
#   docker build -f deploy/Dockerfile.deck -t openclaw-deck .

FROM node:22-bookworm AS build

RUN corepack enable

WORKDIR /app

# --- Dependency layer (cached) ---
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY dashboard/package.json ./dashboard/

RUN --mount=type=cache,id=deck-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    NODE_OPTIONS=--max-old-space-size=2048 \
    pnpm install --frozen-lockfile --filter openclaw-deck...

# --- Source layer ---
COPY dashboard/ ./dashboard/

# Generated gateway types needed by dashboard build
COPY src/gateway/protocol/ ./src/gateway/protocol/
COPY src/gateway/method-registry.ts ./src/gateway/method-registry.ts

RUN cd dashboard && pnpm build

# === Runtime ===
FROM node:22-bookworm-slim

WORKDIR /app

# Copy standalone output
COPY --from=build /app/dashboard/.next/standalone ./
COPY --from=build /app/dashboard/.next/static ./.next/static
COPY --from=build /app/dashboard/public ./public 2>/dev/null || true

# better-sqlite3 native addon (not included in standalone automatically)
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/node_modules/bindings ./node_modules/bindings 2>/dev/null || true
COPY --from=build /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path 2>/dev/null || true
COPY --from=build /app/node_modules/prebuild-install ./node_modules/prebuild-install 2>/dev/null || true

# Migrations
COPY --from=build /app/dashboard/migrations ./migrations

# Data volume mount point
RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV NODE_ENV=production
# Point Deck SQLite to the persistent volume
ENV DECK_DB_PATH=/data/deck.db

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
```

- [ ] **Step 2: 本地测试构建**

```bash
cd /Users/wangym/workspace/agents/openclaw
docker build -f deploy/Dockerfile.deck -t openclaw-deck:test .
```

验证构建成功，记录任何需要调整的文件路径（特别是 standalone 输出结构、better-sqlite3 依赖链）。

- [ ] **Step 3: 测试运行**

```bash
docker run --rm -p 3099:3000 \
  -e DECK_GATEWAY_URL=ws://host.docker.internal:18789 \
  -e DECK_GATEWAY_TOKEN=test \
  -e DECK_DB_PATH=/data/deck.db \
  -v /tmp/deck-test-data:/data \
  openclaw-deck:test
```

在浏览器访问 `http://localhost:3099`，验证 Deck 启动（预期显示 onboarding 页面，因为 Gateway 连接不通是正常的）。

- [ ] **Step 4: 根据测试结果修复 Dockerfile**

如果 Step 2-3 发现问题（缺依赖、路径错误等），修正 `deploy/Dockerfile.deck`。常见问题：

- standalone 输出 `server.js` 路径可能在 `dashboard/` 子目录内
- better-sqlite3 可能需要额外的 `.node` 文件
- migrations 目录相对路径可能需要调整

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add Deck Dockerfile with Next.js standalone build" deploy/Dockerfile.deck
```

---

### Task 5: 创建 Docker Compose 编排

**Files:**

- Create: `deploy/docker-compose.yml`
- Create: `deploy/docker-compose.sandbox.yml`

- [ ] **Step 1: 创建 docker-compose.yml**

Create `deploy/docker-compose.yml`:

```yaml
# OpenClaw Gateway + Deck Dashboard
#
# Usage:
#   cd deploy
#   cp .env.example .env && vim .env
#   docker compose up -d
#
# Sandbox mode:
#   docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d

services:
  gateway:
    build:
      context: ..
      dockerfile: Dockerfile
      args:
        OPENCLAW_DOCKER_APT_PACKAGES: "${OPENCLAW_DOCKER_APT_PACKAGES:-python3 python3-pip ripgrep jq wget}"
        OPENCLAW_INSTALL_DOCKER_CLI: "${OPENCLAW_SANDBOX:-}"
    ports:
      - "${GATEWAY_PORT:-18789}:18789"
    volumes:
      - ${OPENCLAW_STATE_DIR:-./data/gateway}:/home/node/.openclaw
    environment:
      HOME: /home/node
      TERM: xterm-256color
      OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      TZ: ${TZ:-Asia/Shanghai}
    command: ["node", "openclaw.mjs", "gateway", "run", "--bind", "lan", "--port", "18789"]
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:18789/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    init: true
    restart: unless-stopped

  deck:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.deck
    ports:
      - "${DECK_PORT:-3000}:3000"
    volumes:
      - ${DECK_DATA_DIR:-./data/deck}:/data
    environment:
      DECK_GATEWAY_URL: ws://gateway:18789
      DECK_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      DECK_DB_PATH: /data/deck.db
    depends_on:
      gateway:
        condition: service_healthy
    init: true
    restart: unless-stopped
```

- [ ] **Step 2: 创建 docker-compose.sandbox.yml**

Create `deploy/docker-compose.sandbox.yml`:

```yaml
# Sandbox overlay — enables agent execution isolation.
#
# Usage:
#   docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d
#
# Prerequisites:
#   1. Build sandbox images: scripts/sandbox-setup.sh (from repo root)
#   2. Set DOCKER_GID in .env: stat -c '%g' /var/run/docker.sock

services:
  gateway:
    volumes:
      - ${DOCKER_SOCKET:-/var/run/docker.sock}:/var/run/docker.sock
    group_add:
      - "${DOCKER_GID:-999}"
```

- [ ] **Step 3: 端到端测试 docker compose**

先确保 Gateway 不在运行（避免端口冲突）：

```bash
# 停止本地开发 Gateway
scripts/dev/deck-dev.sh stop 2>/dev/null || true

cd deploy
cp .env.example .env

# 填入实际 token（用本机已有的）
EXISTING_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.openclaw/openclaw.json'))['gateway']['auth']['token'])")
sed -i '' "s/^OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$EXISTING_TOKEN/" .env

# 用已有数据目录
sed -i '' "s|^OPENCLAW_STATE_DIR=.*|OPENCLAW_STATE_DIR=$HOME/.openclaw|" .env

# 构建并启动
docker compose up -d --build
```

验证：

- `docker compose ps` — 两个 service 都是 healthy/running
- `curl -s http://localhost:18789/healthz` — Gateway 健康
- 浏览器打开 `http://localhost:3000` — Deck 正常加载

- [ ] **Step 4: 停止测试环境**

```bash
cd deploy && docker compose down
```

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add docker-compose with sandbox overlay" deploy/docker-compose.yml deploy/docker-compose.sandbox.yml
```

---

### Task 6: 创建裸机部署脚本和 systemd units

**Files:**

- Create: `deploy/bare-metal/install.sh`
- Create: `deploy/bare-metal/openclaw-gateway.service`
- Create: `deploy/bare-metal/openclaw-deck.service`

- [ ] **Step 1: 创建 openclaw-gateway.service**

Create `deploy/bare-metal/openclaw-gateway.service`:

```ini
[Unit]
Description=OpenClaw Gateway
Documentation=https://docs.openclaw.ai
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw
Environment=NODE_ENV=production
Environment=OPENCLAW_STATE_DIR=/var/lib/openclaw
EnvironmentFile=-/etc/openclaw/gateway.env
ExecStart=/usr/bin/node openclaw.mjs gateway run --bind loopback --port 18789
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw-gateway

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/openclaw
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: 创建 openclaw-deck.service**

Create `deploy/bare-metal/openclaw-deck.service`:

```ini
[Unit]
Description=OpenClaw Deck Dashboard
Documentation=https://docs.openclaw.ai
After=openclaw-gateway.service
Wants=openclaw-gateway.service

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw/dashboard
Environment=NODE_ENV=production
Environment=DECK_DB_PATH=/var/lib/openclaw-deck/deck.db
EnvironmentFile=-/etc/openclaw/deck.env
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw-deck

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/openclaw-deck
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: 创建 install.sh**

Create `deploy/bare-metal/install.sh`:

```bash
#!/usr/bin/env bash
#
# install.sh — Bare-metal installation for OpenClaw + Deck.
#
# Usage:
#   sudo deploy/bare-metal/install.sh
#
# Prerequisites: Node.js 22+, pnpm, git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

INSTALL_DIR="${OPENCLAW_INSTALL_DIR:-/opt/openclaw}"
STATE_DIR="${OPENCLAW_STATE_DIR:-/var/lib/openclaw}"
DECK_DATA_DIR="${DECK_DATA_DIR:-/var/lib/openclaw-deck}"
CONF_DIR="/etc/openclaw"

log() { echo "[install] $*"; }
err() { echo "[install] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

check_deps() {
  log "Checking dependencies..."
  command -v node >/dev/null || err "node not found. Install Node.js 22+"
  command -v pnpm >/dev/null || err "pnpm not found. Run: corepack enable"
  command -v git  >/dev/null || err "git not found"

  local node_major
  node_major=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  [ "$node_major" -ge 22 ] || err "Node.js 22+ required (found $node_major)"
  log "Dependencies OK (Node $node_major)"
}

# ---------------------------------------------------------------------------
# User setup
# ---------------------------------------------------------------------------

setup_user() {
  if ! id openclaw &>/dev/null; then
    log "Creating openclaw user..."
    useradd --system --create-home --shell /bin/bash openclaw
  fi
}

# ---------------------------------------------------------------------------
# Application install
# ---------------------------------------------------------------------------

install_app() {
  log "Installing to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"

  # Copy or symlink from repo
  if [ "$REPO_DIR" = "$INSTALL_DIR" ]; then
    log "Repo is already at install path, skipping copy"
  else
    rsync -a --delete \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='deploy/data' \
      "$REPO_DIR/" "$INSTALL_DIR/"
  fi

  cd "$INSTALL_DIR"
  log "Installing dependencies..."
  pnpm install --frozen-lockfile

  log "Building Gateway..."
  pnpm build

  log "Building Deck..."
  cd dashboard
  pnpm build
  cd ..

  chown -R openclaw:openclaw "$INSTALL_DIR"
}

# ---------------------------------------------------------------------------
# Data directories + seed
# ---------------------------------------------------------------------------

setup_data() {
  mkdir -p "$STATE_DIR" "$DECK_DATA_DIR" "$CONF_DIR"

  # Load env if available
  if [ -f "$DEPLOY_DIR/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$DEPLOY_DIR/.env"
    set +a
  fi

  # Generate token if not set
  if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
    log "Generated gateway token: ${OPENCLAW_GATEWAY_TOKEN:0:8}..."
  fi
  export OPENCLAW_GATEWAY_TOKEN
  export DEFAULT_MODEL="${DEFAULT_MODEL:-deepseek/deepseek-chat}"

  # Run seed injection
  "$DEPLOY_DIR/scripts/seed.sh" "$STATE_DIR"

  # Write env files for systemd
  cat > "$CONF_DIR/gateway.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
OPENCLAW_STATE_DIR=${STATE_DIR}
EOF

  cat > "$CONF_DIR/deck.env" <<EOF
DECK_GATEWAY_URL=ws://localhost:18789
DECK_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
DECK_DB_PATH=${DECK_DATA_DIR}/deck.db
EOF

  chmod 600 "$CONF_DIR/gateway.env" "$CONF_DIR/deck.env"
  chown -R openclaw:openclaw "$STATE_DIR" "$DECK_DATA_DIR"

  log "Data directories initialized"
}

# ---------------------------------------------------------------------------
# systemd
# ---------------------------------------------------------------------------

install_services() {
  log "Installing systemd units..."
  cp "$SCRIPT_DIR/openclaw-gateway.service" /etc/systemd/system/
  cp "$SCRIPT_DIR/openclaw-deck.service" /etc/systemd/system/

  systemctl daemon-reload
  systemctl enable openclaw-gateway openclaw-deck

  log "Starting services..."
  systemctl start openclaw-gateway
  sleep 3
  systemctl start openclaw-deck

  log "Waiting for health..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:18789/healthz >/dev/null 2>&1; then
      log "Gateway healthy"
      break
    fi
    sleep 1
  done

  for i in $(seq 1 15); do
    if curl -sf http://localhost:3000 >/dev/null 2>&1; then
      log "Deck healthy"
      break
    fi
    sleep 1
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

[ "$(id -u)" -eq 0 ] || err "Run with sudo"

check_deps
setup_user
install_app
setup_data
install_services

log ""
log "========================================="
log "  OpenClaw + Deck installed successfully"
log "========================================="
log ""
log "  Deck:    http://$(hostname -I | awk '{print $1}'):3000"
log "  Gateway: http://localhost:18789"
log ""
log "  Manage:  systemctl {start|stop|restart} openclaw-gateway"
log "           systemctl {start|stop|restart} openclaw-deck"
log "  Logs:    journalctl -u openclaw-gateway -f"
log "           journalctl -u openclaw-deck -f"
log "  Config:  $CONF_DIR/"
log "  Data:    $STATE_DIR/"
log ""
```

- [ ] **Step 4: 设为可执行**

```bash
chmod +x deploy/bare-metal/install.sh
```

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add bare-metal install script and systemd units" deploy/bare-metal/
```

---

### Task 7: 创建 setup.sh 统一入口

**Files:**

- Create: `deploy/scripts/setup.sh`
- Create: `deploy/scripts/teardown.sh`

- [ ] **Step 1: 创建 setup.sh**

Create `deploy/scripts/setup.sh`:

```bash
#!/usr/bin/env bash
#
# setup.sh — Unified deployment entry point for OpenClaw + Deck.
#
# Usage:
#   deploy/scripts/setup.sh                   # interactive mode detection
#   deploy/scripts/setup.sh docker             # Docker mode
#   deploy/scripts/setup.sh docker --sandbox   # Docker + sandbox
#   deploy/scripts/setup.sh bare-metal         # Bare-metal mode
#   deploy/scripts/setup.sh stop               # Stop services
#   deploy/scripts/setup.sh status             # Show status
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

log() { echo "[setup] $*"; }
err() { echo "[setup] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# .env management
# ---------------------------------------------------------------------------

ensure_env() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"
    log "Created $ENV_FILE from template."
    log "Please edit $ENV_FILE and set your API keys, then re-run."
    exit 0
  fi

  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a

  # Auto-generate gateway token if empty
  if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
    OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
    # Persist to .env
    if grep -q '^OPENCLAW_GATEWAY_TOKEN=' "$ENV_FILE"; then
      sed -i.bak "s/^OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN/" "$ENV_FILE"
      rm -f "$ENV_FILE.bak"
    else
      echo "OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN" >> "$ENV_FILE"
    fi
    export OPENCLAW_GATEWAY_TOKEN
    log "Auto-generated gateway token: ${OPENCLAW_GATEWAY_TOKEN:0:8}..."
  fi

  export DEFAULT_MODEL="${DEFAULT_MODEL:-deepseek/deepseek-chat}"
}

# ---------------------------------------------------------------------------
# Docker mode
# ---------------------------------------------------------------------------

docker_up() {
  local sandbox="${1:-}"

  log "Checking Docker..."
  command -v docker >/dev/null || err "docker not found"
  docker compose version >/dev/null 2>&1 || err "docker compose v2 not found"

  ensure_env

  # Seed data
  local state_dir="${OPENCLAW_STATE_DIR:-$DEPLOY_DIR/data/gateway}"
  mkdir -p "$state_dir"
  "$SCRIPT_DIR/seed.sh" "$state_dir"

  # Build & start
  cd "$DEPLOY_DIR"

  if [ "$sandbox" = "--sandbox" ]; then
    log "Building sandbox images..."
    cd "$REPO_DIR"
    docker build -f Dockerfile.sandbox -t openclaw-sandbox:bookworm-slim . 2>/dev/null || log "WARN: sandbox base build failed"
    docker build -f Dockerfile.sandbox-common \
      --build-arg BASE_IMAGE=openclaw-sandbox:bookworm-slim \
      -t openclaw-sandbox:common . 2>/dev/null || log "WARN: sandbox common build failed"
    cd "$DEPLOY_DIR"

    log "Starting with sandbox..."
    docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d --build
  else
    log "Starting..."
    docker compose up -d --build
  fi

  log "Waiting for services..."
  sleep 5

  docker_status
}

docker_down() {
  cd "$DEPLOY_DIR"
  if [ -f docker-compose.sandbox.yml ] && docker compose -f docker-compose.yml -f docker-compose.sandbox.yml ps --quiet 2>/dev/null | grep -q .; then
    docker compose -f docker-compose.yml -f docker-compose.sandbox.yml down
  else
    docker compose down
  fi
  log "Services stopped."
}

docker_status() {
  cd "$DEPLOY_DIR"
  echo ""
  docker compose ps
  echo ""

  local gw_ok=false deck_ok=false
  curl -sf "http://localhost:${GATEWAY_PORT:-18789}/healthz" >/dev/null 2>&1 && gw_ok=true
  curl -sf "http://localhost:${DECK_PORT:-3000}" >/dev/null 2>&1 && deck_ok=true

  log "Gateway: $( [ "$gw_ok" = true ] && echo "healthy" || echo "unreachable" )"
  log "Deck:    $( [ "$deck_ok" = true ] && echo "healthy" || echo "unreachable" )"

  if [ "$deck_ok" = true ]; then
    echo ""
    log "Access Deck at: http://localhost:${DECK_PORT:-3000}"
  fi
}

# ---------------------------------------------------------------------------
# Bare-metal mode
# ---------------------------------------------------------------------------

bare_metal_up() {
  ensure_env
  log "Launching bare-metal installer..."
  exec sudo -E "$DEPLOY_DIR/bare-metal/install.sh"
}

bare_metal_status() {
  systemctl status openclaw-gateway --no-pager 2>/dev/null || log "Gateway service not found"
  echo ""
  systemctl status openclaw-deck --no-pager 2>/dev/null || log "Deck service not found"
}

bare_metal_down() {
  sudo systemctl stop openclaw-deck openclaw-gateway 2>/dev/null || true
  log "Services stopped."
}

# ---------------------------------------------------------------------------
# Interactive mode detection
# ---------------------------------------------------------------------------

detect_mode() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log "Docker detected. Use 'docker' or 'bare-metal'?"
    read -rp "[docker/bare-metal] (default: docker): " mode
    mode="${mode:-docker}"
  else
    log "Docker not found, defaulting to bare-metal."
    mode="bare-metal"
  fi
  echo "$mode"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-}" in
  docker)
    docker_up "${2:-}"
    ;;
  bare-metal)
    bare_metal_up
    ;;
  stop)
    if systemctl is-active openclaw-gateway >/dev/null 2>&1; then
      bare_metal_down
    else
      docker_down
    fi
    ;;
  status)
    if systemctl is-active openclaw-gateway >/dev/null 2>&1; then
      bare_metal_status
    else
      docker_status
    fi
    ;;
  "")
    mode=$(detect_mode)
    case "$mode" in
      docker)     docker_up ;;
      bare-metal) bare_metal_up ;;
      *)          err "Unknown mode: $mode" ;;
    esac
    ;;
  *)
    echo "Usage: $0 [docker [--sandbox] | bare-metal | stop | status]"
    exit 1
    ;;
esac
```

- [ ] **Step 2: 创建 teardown.sh**

Create `deploy/scripts/teardown.sh`:

```bash
#!/usr/bin/env bash
#
# teardown.sh — Remove OpenClaw deployment.
#
# Usage:
#   deploy/scripts/teardown.sh docker      # Remove Docker containers + images
#   deploy/scripts/teardown.sh bare-metal   # Remove systemd services
#   deploy/scripts/teardown.sh all          # Remove everything including data
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() { echo "[teardown] $*"; }

case "${1:-}" in
  docker)
    cd "$DEPLOY_DIR"
    docker compose down --rmi local --volumes 2>/dev/null || true
    docker compose -f docker-compose.yml -f docker-compose.sandbox.yml down --rmi local --volumes 2>/dev/null || true
    log "Docker resources removed."
    ;;
  bare-metal)
    sudo systemctl stop openclaw-deck openclaw-gateway 2>/dev/null || true
    sudo systemctl disable openclaw-deck openclaw-gateway 2>/dev/null || true
    sudo rm -f /etc/systemd/system/openclaw-gateway.service /etc/systemd/system/openclaw-deck.service
    sudo systemctl daemon-reload
    log "systemd services removed."
    ;;
  all)
    "$0" docker
    "$0" bare-metal
    log "Removing data directories..."
    rm -rf "$DEPLOY_DIR/data"
    sudo rm -rf /var/lib/openclaw /var/lib/openclaw-deck /etc/openclaw 2>/dev/null || true
    log "All data removed."
    ;;
  *)
    echo "Usage: $0 [docker | bare-metal | all]"
    exit 1
    ;;
esac
```

- [ ] **Step 3: 设为可执行**

```bash
chmod +x deploy/scripts/setup.sh deploy/scripts/teardown.sh
```

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add unified setup.sh entry point and teardown script" deploy/scripts/setup.sh deploy/scripts/teardown.sh
```

---

### Task 8: 创建 deploy/README.md

**Files:**

- Create: `deploy/README.md`

- [ ] **Step 1: 创建 README.md**

Create `deploy/README.md`:

````markdown
# OpenClaw + Deck 部署指南

部署 OpenClaw Gateway 和 Deck Dashboard，支持三种模式。

## 快速开始

### Docker 部署（推荐）

```bash
cd deploy
cp .env.example .env
vim .env                    # 填写 API keys
./scripts/setup.sh docker   # 构建并启动
```
````

访问 `http://localhost:3000` 打开 Deck 面板。

### Docker + Sandbox

```bash
cd deploy
cp .env.example .env
vim .env                              # 填写 API keys + OPENCLAW_SANDBOX=1
./scripts/setup.sh docker --sandbox   # 构建 sandbox 镜像 + 启动
```

### 裸机部署

```bash
cd deploy
cp .env.example .env
vim .env                         # 填写 API keys
./scripts/setup.sh bare-metal    # 安装依赖、构建、启动 systemd 服务
```

## 架构

```
浏览器 → Deck (:3000) → Gateway (:18789) → AI Providers / Channels
                                    ↓ (可选)
                              Sandbox 容器
```

- **Gateway**: OpenClaw 核心，管理 agent、通道、模型路由
- **Deck**: Web Dashboard，通过 WebSocket 连接 Gateway
- **Sandbox**: 可选的 agent 执行隔离环境

## 环境变量

| 变量                     | 必填     | 说明                                      |
| ------------------------ | -------- | ----------------------------------------- |
| `DEEPSEEK_API_KEY`       | 至少一个 | DeepSeek API Key                          |
| `ANTHROPIC_API_KEY`      | 至少一个 | Anthropic API Key                         |
| `OPENAI_API_KEY`         | 至少一个 | OpenAI API Key                            |
| `OPENCLAW_GATEWAY_TOKEN` | 自动生成 | Gateway 认证 token                        |
| `DEFAULT_MODEL`          | 否       | 默认模型（默认 `deepseek/deepseek-chat`） |
| `GATEWAY_PORT`           | 否       | Gateway 端口（默认 18789）                |
| `DECK_PORT`              | 否       | Deck 端口（默认 3000）                    |
| `TZ`                     | 否       | 时区（默认 `Asia/Shanghai`）              |
| `OPENCLAW_SANDBOX`       | 否       | 设为 1 启用 sandbox                       |
| `DOCKER_GID`             | sandbox  | Docker socket GID                         |

## 管理命令

```bash
# Docker
./scripts/setup.sh status          # 查看状态
./scripts/setup.sh stop            # 停止
docker compose logs -f gateway     # Gateway 日志
docker compose logs -f deck        # Deck 日志
docker compose up -d --build       # 重新构建并启动

# 裸机
systemctl status openclaw-gateway  # Gateway 状态
systemctl status openclaw-deck     # Deck 状态
journalctl -u openclaw-gateway -f  # Gateway 日志
journalctl -u openclaw-deck -f     # Deck 日志
sudo systemctl restart openclaw-gateway openclaw-deck  # 重启
```

## 种子定制

`seed/` 目录包含预置配置，部署时自动注入：

- `seed/openclaw.json.tmpl` — 主配置模板（模型、agent、通道）
- `seed/agents/` — 预置 agent 定义
- `seed/cron/jobs.json` — 预置定时任务

修改种子后重新部署即可生效。详见 `seed/README.md`。

## 升级

### Docker

```bash
cd /path/to/openclaw
git pull --rebase origin enhanced
cd deploy
docker compose up -d --build
```

### 裸机

```bash
cd /opt/openclaw
git pull --rebase origin enhanced
pnpm install && pnpm build
cd dashboard && pnpm build && cd ..
sudo systemctl restart openclaw-gateway openclaw-deck
```

## 分离部署

Gateway 和 Deck 可以部署在不同机器上：

1. 在 Gateway 机器上只启动 gateway 服务
2. 在 Deck 机器上修改 `.env`：
   ```
   DECK_GATEWAY_URL=ws://<gateway-host>:18789
   ```
3. Gateway 需要 `--bind lan`（Docker 默认已配置）

## 故障排查

| 问题                  | 排查                                                            |
| --------------------- | --------------------------------------------------------------- |
| Deck 无法连接 Gateway | 检查 `DECK_GATEWAY_URL` 和 `DECK_GATEWAY_TOKEN`                 |
| Gateway 启动失败      | 检查端口占用：`lsof -i :18789`                                  |
| Docker 构建 OOM       | 增加 Docker 内存或添加 `NODE_OPTIONS=--max-old-space-size=2048` |
| Sandbox 无法启动      | 检查 docker.sock 权限和 DOCKER_GID                              |
| 首次访问 Deck 白屏    | 等待 Gateway 健康检查通过后刷新                                 |

## 清理

```bash
./scripts/teardown.sh docker      # 删除 Docker 容器和镜像
./scripts/teardown.sh bare-metal  # 删除 systemd 服务
./scripts/teardown.sh all         # 删除所有（含数据）
```

````

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] docs(deploy): add comprehensive deployment README" deploy/README.md
````

---

### Task 9: 创建 deploy/CLAUDE.md

**Files:**

- Create: `deploy/CLAUDE.md`

- [ ] **Step 1: 创建 CLAUDE.md**

Create `deploy/CLAUDE.md`:

````markdown
# Deploy — Claude Code 操作指引

本文件指导 Claude Code 如何执行 OpenClaw + Deck 的部署操作。

## 部署架构

- Gateway（:18789）: OpenClaw 核心，源码构建
- Deck（:3000）: Next.js standalone dashboard
- 连接: Deck → Gateway via WebSocket（`DECK_GATEWAY_URL`）
- 认证: `OPENCLAW_GATEWAY_TOKEN` + Ed25519 device identity

## 关键文件

| 文件                                | 用途                             |
| ----------------------------------- | -------------------------------- |
| `deploy/scripts/setup.sh`           | 统一部署入口                     |
| `deploy/scripts/seed.sh`            | 种子数据注入                     |
| `deploy/docker-compose.yml`         | Docker 编排                      |
| `deploy/docker-compose.sandbox.yml` | Sandbox overlay                  |
| `deploy/Dockerfile.deck`            | Deck 镜像构建                    |
| `deploy/bare-metal/install.sh`      | 裸机安装                         |
| `deploy/.env`                       | 环境配置（从 .env.example 复制） |

## Docker 部署命令序列

```bash
# 1. 进入部署目录
cd deploy

# 2. 初始化配置（如果没有 .env）
cp .env.example .env

# 3. 编辑 .env 设置 API keys
# DEEPSEEK_API_KEY=sk-xxx

# 4a. 标准部署
./scripts/setup.sh docker

# 4b. 带 sandbox
./scripts/setup.sh docker --sandbox

# 5. 验证
docker compose ps
curl -s http://localhost:18789/healthz
curl -s http://localhost:3000
```
````

## 裸机部署命令序列

```bash
# 1. 初始化配置
cd deploy && cp .env.example .env
# 编辑 .env

# 2. 执行安装（需要 sudo）
./scripts/setup.sh bare-metal

# 3. 验证
systemctl status openclaw-gateway
systemctl status openclaw-deck
curl -s http://localhost:18789/healthz
curl -s http://localhost:3000
```

## 环境检查清单

在部署前验证以下条件：

- [ ] Node.js 22+ 已安装（`node --version`）
- [ ] pnpm 可用（`pnpm --version`，或 `corepack enable`）
- [ ] Docker 可用（Docker 模式）（`docker compose version`）
- [ ] `.env` 文件已创建且至少一个 API key 已设置
- [ ] Gateway 端口 18789 未被占用（`lsof -i :18789`）
- [ ] Deck 端口 3000 未被占用（`lsof -i :3000`）
- [ ] 本地开发环境已停止（`scripts/dev/deck-dev.sh stop`）

## 常见错误诊断

### Gateway 连接失败

```bash
# 检查 Gateway 日志
docker compose logs gateway --tail 50
# 或
journalctl -u openclaw-gateway --no-pager -n 50

# 常见原因:
# - OPENCLAW_GATEWAY_TOKEN 不匹配 → 检查 .env 和 seed 注入结果
# - 端口冲突 → lsof -i :18789
# - 配置格式错误 → 检查 data/gateway/openclaw.json
```

### Deck 白屏或 500

```bash
# 检查 Deck 日志
docker compose logs deck --tail 50
# 或
journalctl -u openclaw-deck --no-pager -n 50

# 常见原因:
# - better-sqlite3 native addon 缺失 → 重新构建 Deck 镜像
# - DECK_GATEWAY_URL 错误 → Docker 内应为 ws://gateway:18789
# - migrations 目录缺失 → 检查 Dockerfile COPY 步骤
```

### Sandbox 不工作

```bash
# 检查 sandbox 镜像
docker images | grep sandbox

# 如果没有镜像，从仓库根目录构建:
docker build -f Dockerfile.sandbox -t openclaw-sandbox:bookworm-slim .
docker build -f Dockerfile.sandbox-common --build-arg BASE_IMAGE=openclaw-sandbox:bookworm-slim -t openclaw-sandbox:common .

# 检查 docker.sock 权限
ls -la /var/run/docker.sock
# DOCKER_GID 应匹配 socket 的 group ID
```

## 配置修改后操作

```bash
# 修改 .env 后（Docker）
cd deploy && docker compose up -d

# 修改 seed 后需重新注入
./scripts/seed.sh ./data/gateway --force
docker compose restart gateway

# 修改源码后需重新构建
docker compose up -d --build

# 裸机模式修改后
sudo systemctl restart openclaw-gateway openclaw-deck
```

## 日志位置

| 模式   | Gateway 日志                        | Deck 日志                        |
| ------ | ----------------------------------- | -------------------------------- |
| Docker | `docker compose logs -f gateway`    | `docker compose logs -f deck`    |
| 裸机   | `journalctl -u openclaw-gateway -f` | `journalctl -u openclaw-deck -f` |

## 重要约束

- Gateway 必须从源码构建（增强 fork 包含自定义 RPC handlers）
- 不要使用全局安装的 `openclaw` 命令
- Docker 模式下 Gateway 使用 `--bind lan`（容器间通信需要）
- 裸机模式下 Gateway 使用 `--bind loopback`（安全）
- `deploy/.env` 包含敏感信息，不要提交到 git

```

- [ ] **Step 2: 在仓库根目录创建 CLAUDE.md 符号链接**

根据项目规范（"当添加新 AGENTS.md 时也要添加 CLAUDE.md 符号链接"），deploy 目录的 CLAUDE.md 是独立文件（不是符号链接），因为它有特定内容。

- [ ] **Step 3: 将 deploy/.env 加入 .gitignore**

检查 `.gitignore` 是否已忽略 `deploy/.env`，如果没有则添加：

```

# deploy secrets

deploy/.env
deploy/data/

````

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] docs(deploy): add CLAUDE.md deployment guide for Claude Code" deploy/CLAUDE.md
````

---

### Task 10: 端到端验证

**Files:** 无新文件，验证现有产物。

- [ ] **Step 1: Docker 模式端到端测试**

```bash
# 确保本地开发环境已停
scripts/dev/deck-dev.sh stop 2>/dev/null || true

cd deploy
cp .env.example .env

# 填入实际 API key（至少一个）
# 如果有已有 token，复用；否则 setup.sh 会自动生成

./scripts/setup.sh docker
```

验证清单：

- `docker compose ps` 显示 gateway 和 deck 都是 running
- `curl -s http://localhost:18789/healthz` 返回 OK
- 浏览器访问 `http://localhost:3000` 显示 Deck UI
- 检查 `data/gateway/openclaw.json` 中 token 已正确渲染
- 检查 `data/gateway/agents/main/IDENTITY.md` 存在

- [ ] **Step 2: 验证 seed 幂等性**

```bash
# 再次运行 seed（应跳过已有文件）
./scripts/seed.sh ./data/gateway
# 输出应包含 "already initialized" 和 "skip" 消息
```

- [ ] **Step 3: 验证 sandbox overlay**

```bash
./scripts/setup.sh stop

# 设置 sandbox
echo "OPENCLAW_SANDBOX=1" >> .env
./scripts/setup.sh docker --sandbox

# 检查 sandbox 镜像已构建
docker images | grep sandbox

./scripts/setup.sh stop
```

- [ ] **Step 4: 清理**

```bash
./scripts/teardown.sh docker
```

- [ ] **Step 5: 修复验证中发现的问题**

根据 Step 1-4 的实际结果，修复所有问题并重新提交。

- [ ] **Step 6: Final commit**

```bash
# 如果有修复
scripts/committer "[enhanced] fix(deploy): address issues found during e2e validation" <changed-files>
```
