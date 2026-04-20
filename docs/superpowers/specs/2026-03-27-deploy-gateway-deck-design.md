# OpenClaw + Deck 部署方案设计

**日期**: 2026-03-27
**状态**: 设计完成，待实施

## 1. 概述

为增强 fork 的 OpenClaw Gateway + Deck Dashboard 提供生产级部署方案，支持三种部署模式：

| 模式                 | 描述                                       | 适用场景              |
| -------------------- | ------------------------------------------ | --------------------- |
| **Docker**           | docker compose 编排，Gateway + Deck 双容器 | 标准服务器部署        |
| **Docker + Sandbox** | 同上 + agent 执行隔离                      | 多租户 / 安全敏感     |
| **裸机**             | systemd 管理两个进程                       | 物理机 / 已有基础设施 |

### 设计目标

- 源码构建增强 fork（含自定义 RPC handlers）
- 预置配置种子（agents、models、channels），开箱即用
- 种子层可定制（增删改预置内容）
- 默认同机部署，保留分离部署能力
- 数据持久化（Gateway 配置 + Deck SQLite）
- 完整文档（人类 README + Claude Code CLAUDE.md）

## 2. 整体架构

```
                    用户浏览器
                        │ HTTP :3000
               ┌────────┴────────┐
               │   Deck (Next.js) │
               │   standalone     │
               │                  │
               │  SQLite DB ──────┤── volume / disk: deck-data
               │  (device id,     │
               │   settings,      │
               │   projections)   │
               └────────┬────────┘
                        │ WebSocket (internal)
                        ▼ :18789
               ┌─────────────────┐
               │    Gateway       │──docker.sock──→ Sandbox 容器（可选）
               │  (from source)   │                 ├── base
               │                  │                 ├── common
               │  ~/.openclaw/ ───┤── volume / disk │── browser
               │  (openclaw.json, │
               │   agents, logs)  │
               └─────────────────┘
                        │
                        ▼
               AI Providers / Channels
```

### 部署拓扑对照

| 模式        | Gateway     | Deck        | 网络                              |
| ----------- | ----------- | ----------- | --------------------------------- |
| Docker      | 容器 A      | 容器 B      | docker network（`gateway:18789`） |
| Docker 分离 | 主机 A 容器 | 主机 B 容器 | 跨主机网络（`ws://host-a:18789`） |
| 裸机        | 进程 A      | 进程 B      | localhost:18789                   |

### 关键连接参数

| 参数                     | 说明                   | Docker 值            | 裸机值                 |
| ------------------------ | ---------------------- | -------------------- | ---------------------- |
| `DECK_GATEWAY_URL`       | Gateway WebSocket 地址 | `ws://gateway:18789` | `ws://localhost:18789` |
| `DECK_GATEWAY_TOKEN`     | Gateway 认证 token     | 自动生成或 env 注入  | 同左                   |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway 端 token       | 与上一致             | 与上一致               |

首次连接时 Deck 自动完成 Ed25519 device pairing，获取 operator scope。

## 3. Seed Layer（种子层）

### 概念

Seed Layer 将预配置的 agents、models、channels 等打包到部署产物中，首次安装时自动注入目标目录，实现开箱即用。种子层可定制——修改 `deploy/seed/` 下的文件即可改变预置内容。

### 三类种子策略

| 策略            | 行为                             | 适用内容                                    |
| --------------- | -------------------------------- | ------------------------------------------- |
| **init-once**   | 仅首次部署写入，用户修改后不覆盖 | `openclaw.json`, `agents/`, `cron/`         |
| **always-sync** | 每次启动/升级都覆盖              | `skills/`, `extensions/` 内置插件           |
| **never-seed**  | 运行时生成，不预置               | `devices/`, `logs/`, `sessions/`, `deck.db` |

### 配置模板机制

`openclaw.json.tmpl` 使用 `${VAR:-default}` 语法的占位符，`seed.sh` 在注入时用 `envsubst` 渲染：

```jsonc
{
  "models": {
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com",
        "apiKey": "${DEEPSEEK_API_KEY:-}",
        "models": [
          // 预置模型列表
        ],
      },
    },
  },
  "agents": {
    "defaults": {
      "model": { "primary": "${DEFAULT_MODEL:-deepseek/deepseek-chat}" },
    },
    "list": [
      // 预置 agent 列表
    ],
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}",
    },
  },
}
```

### 种子注入流程（seed.sh）

```
输入: 源目录（deploy/seed/）, 目标目录（OPENCLAW_STATE_DIR）

1. 目标目录不存在或无 .seed-initialized 标记
   ├── 复制 init-once 文件（openclaw.json.tmpl → openclaw.json, agents/, cron/）
   ├── envsubst 渲染模板占位符
   └── 写入 .seed-initialized（含版本号和时间戳）

2. 目标目录已有 .seed-initialized
   ├── 跳过 init-once 文件（用户可能已修改）
   └── 只更新 always-sync 文件

3. 始终跳过 never-seed 目录
```

## 4. Deck Dockerfile

```dockerfile
# deploy/Dockerfile.deck

# ── Build Stage ──
FROM node:22-bookworm AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY dashboard/package.json ./dashboard/

RUN --mount=type=cache,id=deck-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter openclaw-deck...

COPY dashboard/ ./dashboard/

# 生成的类型文件需要从主项目复制
COPY src/gateway/protocol/ ./src/gateway/protocol/

RUN cd dashboard && pnpm build

# ── Runtime Stage ──
FROM node:22-bookworm-slim
WORKDIR /app

COPY --from=build /app/dashboard/.next/standalone ./
COPY --from=build /app/dashboard/.next/static ./.next/static
COPY --from=build /app/dashboard/public ./public

# better-sqlite3 native addon
COPY --from=build /app/dashboard/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# migrations
COPY --from=build /app/dashboard/migrations ./migrations

RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV NODE_ENV=production
ENV DECK_DATA_DIR=/data
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/gateway/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
```

### 设计决策

1. **基础镜像**: Node 22 bookworm / bookworm-slim，与 Gateway 统一
2. **standalone 输出**: Next.js `output: "standalone"` 已配置，自包含无需 node_modules
3. **native addon**: `better-sqlite3` 需要显式复制（standalone 不自动包含 native modules）
4. **migrations**: 复制迁移文件，Deck 启动时自动运行
5. **数据目录**: `/data` 挂载 volume，存放 SQLite DB
6. **非 root**: node 用户（UID 1000）
7. **健康检查**: 通过 Deck 自身的 API 路由检查

## 5. Docker Compose 编排

```yaml
# deploy/docker-compose.yml

services:
  gateway:
    build:
      context: ..
      dockerfile: Dockerfile
      args:
        OPENCLAW_DOCKER_APT_PACKAGES: "python3 python3-pip ripgrep jq wget"
        OPENCLAW_INSTALL_DOCKER_CLI: "${OPENCLAW_SANDBOX:-}"
    ports:
      - "${GATEWAY_PORT:-18789}:18789"
    volumes:
      - ${OPENCLAW_STATE_DIR:-./data/gateway}:/home/node/.openclaw
    environment:
      OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      TZ: ${TZ:-Asia/Shanghai}
    command:
      - node
      - openclaw.mjs
      - gateway
      - run
      - --bind
      - lan
      - --port
      - "18789"
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
    restart: unless-stopped

  deck:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.deck
    ports:
      - "${DECK_PORT:-3000}:3000"
    volumes:
      - deck-data:/data
    environment:
      DECK_GATEWAY_URL: ws://gateway:18789
      DECK_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      DECK_DATA_DIR: /data
    depends_on:
      gateway:
        condition: service_healthy
    restart: unless-stopped

volumes:
  deck-data:
```

### Sandbox 扩展（docker-compose.sandbox.yml）

启用 sandbox 时通过 override 文件叠加：

```yaml
# deploy/docker-compose.sandbox.yml

services:
  gateway:
    volumes:
      - ${DOCKER_SOCKET:-/var/run/docker.sock}:/var/run/docker.sock
    group_add:
      - "${DOCKER_GID:-999}"
```

使用方式：

```bash
# 无 sandbox
docker compose up -d

# 有 sandbox
docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d
```

## 6. 裸机部署

### 前置依赖

- Node.js 22+
- pnpm（corepack enable）
- Git
- 可选: python3, ripgrep, jq 等 agent 工具

### 目录结构

```
/opt/openclaw/                      # 应用目录（git clone）
├── src/                            # Gateway 源码
├── dashboard/                      # Deck 源码
└── deploy/                         # 部署脚本

/var/lib/openclaw/                  # Gateway 数据（= ~/.openclaw）
├── openclaw.json                   # 从 seed 初始化
├── agents/
├── cron/
└── ...

/var/lib/openclaw-deck/             # Deck 数据
└── deck.db                         # SQLite
```

### systemd Units

**openclaw-gateway.service**:

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw
Environment=OPENCLAW_STATE_DIR=/var/lib/openclaw
Environment=NODE_ENV=production
ExecStart=/usr/bin/node openclaw.mjs gateway run --bind loopback --port 18789
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**openclaw-deck.service**:

```ini
[Unit]
Description=OpenClaw Deck Dashboard
After=openclaw-gateway.service
Requires=openclaw-gateway.service

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw/dashboard
Environment=NODE_ENV=production
Environment=DECK_GATEWAY_URL=ws://localhost:18789
EnvironmentFile=/etc/openclaw/deck.env
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### install.sh 流程

```
1. 检查依赖（node 22+, pnpm, git）
2. 创建 openclaw 用户和组
3. git clone / pull 到 /opt/openclaw
4. pnpm install && pnpm build
5. cd dashboard && pnpm build
6. 运行 seed.sh 初始化 /var/lib/openclaw
7. 安装 systemd units
8. systemctl enable --now openclaw-gateway openclaw-deck
9. 健康检查验证
```

## 7. Agent 执行能力对照

| 部署模式          | Agent 执行环境    | 工具来源                                        | 隔离级别    |
| ----------------- | ----------------- | ----------------------------------------------- | ----------- |
| 裸机              | 宿主机直接        | 宿主机工具链                                    | 无          |
| Docker 无 sandbox | Gateway 容器内    | Dockerfile 打入（OPENCLAW_DOCKER_APT_PACKAGES） | 容器级      |
| Docker 有 sandbox | 独立 sandbox 容器 | sandbox 镜像（base/common/browser）             | 容器+会话级 |

### Sandbox 镜像层级

| 镜像                             | 包含工具                                                             | 大小   |
| -------------------------------- | -------------------------------------------------------------------- | ------ |
| `openclaw-sandbox:bookworm-slim` | bash, curl, git, python3, ripgrep, jq                                | ~200MB |
| `openclaw-sandbox:common`        | + nodejs, npm, pnpm, bun, golang, rust, cargo, brew, build-essential | ~1.5GB |
| `openclaw-sandbox:browser`       | + chromium, xvfb, vnc, websockify                                    | ~800MB |

Sandbox 配置在 `openclaw.json` 中：

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "off | non-main | all",
        "scope": "session | agent | shared"
      }
    }
  }
}
```

## 8. 完整文件结构

```
deploy/
├── README.md                        # 部署指南（三种模式完整说明）
├── CLAUDE.md                        # Claude Code 部署操作指引
├── docker-compose.yml               # Gateway + Deck 编排
├── docker-compose.sandbox.yml       # Sandbox overlay
├── Dockerfile.deck                  # Deck 独立镜像
├── .env.example                     # 环境变量模板
│
├── seed/                            # 种子数据（可定制）
│   ├── openclaw.json.tmpl           # 主配置模板
│   ├── agents/                      # 预置 agents
│   │   └── main/
│   │       ├── IDENTITY.md
│   │       └── agent/
│   │           ├── models.json
│   │           └── auth-profiles.json
│   ├── cron/
│   │   └── jobs.json                # 预置定时任务
│   └── README.md                    # 种子定制说明
│
├── scripts/
│   ├── setup.sh                     # 一键初始化（统一入口）
│   ├── seed.sh                      # 种子注入逻辑
│   └── teardown.sh                  # 清理卸载
│
└── bare-metal/
    ├── install.sh                   # 裸机安装脚本
    ├── openclaw-gateway.service     # systemd unit
    └── openclaw-deck.service        # systemd unit
```

### .env.example

```bash
# === 必填 ===
# AI Provider API Keys（至少配一个）
DEEPSEEK_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# === 自动生成（setup.sh 会填充） ===
OPENCLAW_GATEWAY_TOKEN=

# === 可选 ===
# 默认模型
DEFAULT_MODEL=deepseek/deepseek-chat

# 端口
GATEWAY_PORT=18789
DECK_PORT=3000

# 时区
TZ=Asia/Shanghai

# Gateway 数据目录（Docker 模式）
OPENCLAW_STATE_DIR=./data/gateway

# Sandbox（设为 1 启用）
OPENCLAW_SANDBOX=
DOCKER_GID=999

# 频道 Token（按需）
TELEGRAM_BOT_TOKEN=
DISCORD_BOT_TOKEN=
```

## 9. setup.sh 统一入口流程

```bash
./deploy/scripts/setup.sh                        # 交互式检测
./deploy/scripts/setup.sh docker                  # Docker 模式
./deploy/scripts/setup.sh docker --sandbox        # Docker + Sandbox
./deploy/scripts/setup.sh bare-metal              # 裸机模式
./deploy/scripts/setup.sh stop                    # 停止服务
./deploy/scripts/setup.sh status                  # 查看状态
```

### 执行流程

```
1. 解析参数，确定模式
2. 检查前置依赖
   ├── docker: docker, docker compose v2
   ├── bare-metal: node 22+, pnpm, git
   └── sandbox: + docker（宿主机）
3. 如果 .env 不存在 → 从 .env.example 复制，提示编辑
4. 加载 .env
5. 如果 OPENCLAW_GATEWAY_TOKEN 为空 → openssl rand -hex 32 生成
6. 运行 seed.sh 注入种子数据
7. 按模式启动
   ├── docker: docker compose build && docker compose up -d
   ├── docker --sandbox:
   │   ├── 构建 sandbox 镜像
   │   ├── 注入 sandbox 配置到 openclaw.json
   │   └── docker compose -f ... -f docker-compose.sandbox.yml up -d
   └── bare-metal:
       ├── pnpm install && pnpm build
       ├── cd dashboard && pnpm build
       ├── 安装 systemd units
       └── systemctl start ...
8. 等待健康检查通过
9. 输出:
   ├── Deck URL: http://<host>:3000
   ├── Gateway URL: http://<host>:18789
   └── 首次使用提示
```

## 10. 文档产物

### deploy/README.md

面向人类的部署指南，包含：

- 快速开始（3 步部署）
- 三种部署模式详细说明
- 环境变量参考
- 种子定制指南
- 升级流程
- 故障排查
- 分离部署配置（Gateway 和 Deck 在不同机器）

### deploy/CLAUDE.md

面向 Claude Code 的操作指引，包含：

- 部署命令序列（可直接执行）
- 环境检查清单
- 常见错误诊断流程
- 配置修改后的重启步骤
- 日志位置和查看命令

## 11. 安全考虑

- Gateway 在 Docker 内用 `--bind lan`（容器间通信需要），但只通过 Deck 代理暴露
- Gateway 端口不对外暴露（除非分离部署）
- 裸机模式 Gateway 用 `--bind loopback`
- Token 认证保护 Gateway 通信
- Deck Ed25519 device identity 双重认证
- 非 root 运行（Docker: node 用户；裸机: openclaw 用户）
- SSL/HTTPS 暂不包含，后续通过前置反向代理补充

## 12. 未来扩展

- **SSL 支持**: 在 compose 中添加 Nginx/Caddy service
- **多实例**: 通过 compose profiles 或 K8s 扩展
- **监控**: Prometheus metrics endpoint + Grafana dashboard
- **备份**: 定时备份 Gateway 配置 + Deck SQLite
