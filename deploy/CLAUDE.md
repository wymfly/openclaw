# Deploy — Claude Code 操作指引

本文件指导 Claude Code 如何执行 OpenClaw + Deck 的部署操作。

## 部署架构

- Gateway（:18789）: OpenClaw 核心，源码构建
- Deck（:3000）: Next.js standalone dashboard
- 连接: Deck → Gateway via WebSocket（`DECK_GATEWAY_URL`）
- 认证: `OPENCLAW_GATEWAY_TOKEN` + Ed25519 device identity
- Docker 模式: Deck 与 Gateway 共享网络（`network_mode: service:gateway`），通过 localhost 自动配对

## 关键文件

| 文件 | 用途 |
|------|------|
| `deploy/scripts/package.sh` | 一键打包部署包（跨机器部署） |
| `deploy/scripts/setup.sh` | 统一部署入口（本地构建模式） |
| `deploy/scripts/seed.sh` | 种子数据注入（extensions/skills/agents/config） |
| `deploy/scripts/teardown.sh` | 清理卸载 |
| `deploy/docker-compose.yml` | Docker 编排（本地构建模式） |
| `deploy/docker-compose.sandbox.yml` | Sandbox overlay |
| `deploy/Dockerfile.deck` | Deck 镜像构建 |
| `deploy/bare-metal/install.sh` | 裸机安装 |
| `deploy/.env.example` | 环境变量模板 |
| `deploy/seed/` | 种子数据目录（可定制） |

## 打包部署命令序列（推荐用于跨机器部署）

```bash
# 1. 在开发机打包（含本机插件和 skills）
deploy/scripts/package.sh --with-local

# 2. 传输到目标机器
scp deploy/openclaw-deploy-*.tar.gz user@target:/tmp/

# 3. 在目标机器上
ssh user@target
tar xzf /tmp/openclaw-deploy-*.tar.gz
cd openclaw-deploy-*

# 4. 部署
./install.sh docker            # 交互式或指定模式
# 首次会提示编辑 .env 设置 API keys
vim deploy/.env
./install.sh docker            # 再次运行

# 5. 验证
curl -s http://localhost:18789/healthz
curl -s http://localhost:3000
```

### package.sh 参数

| 参数 | 说明 |
|------|------|
| （无参数） | 构建 Docker 镜像 + 打包源码 |
| `--with-local` | 额外收集 `~/.openclaw/extensions/` 和 `~/.openclaw/skills/` |
| `--docker-only` | 仅 Docker 镜像（不含源码，目标机器只需 Docker） |
| `--source-only` | 仅源码（不构建 Docker，目标机器需 Node 22+） |
| `--output /path` | 指定输出目录 |

### --with-local 收集内容

| 内容 | 来源 | 种子策略 |
|------|------|---------|
| 运行时插件 | `~/.openclaw/extensions/*/` | init-once（不覆盖已修改的） |
| 自定义 skills | `~/.openclaw/skills/*/` | always-sync（每次升级覆盖） |
| 插件启用配置 | `openclaw.json` plugins 段 | 合并到目标 openclaw.json |

## Docker 本地构建部署命令序列

```bash
# 1. 进入部署目录
cd deploy

# 2. 初始化配置（如果没有 .env）
cp .env.example .env

# 3. 编辑 .env 设置 API keys

# 4a. 标准部署
./scripts/setup.sh docker

# 4b. 带 sandbox
./scripts/setup.sh docker --sandbox

# 5. 验证
docker compose ps
curl -s http://localhost:18789/healthz
curl -s http://localhost:3000
```

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

- [ ] Node.js 22+ 已安装（`node --version`）（裸机模式）
- [ ] pnpm 可用（`pnpm --version`，或 `corepack enable`）（裸机模式）
- [ ] Docker + Docker Compose v2 可用（`docker compose version`）（Docker 模式）
- [ ] `.env` 文件已创建且至少一个 API key 已设置
- [ ] Gateway 端口 18789 未被占用（`lsof -i :18789`）
- [ ] Deck 端口 3000 未被占用（`lsof -i :3000`）
- [ ] 本地开发环境已停止（`scripts/dev/deck-dev.sh stop`）
- [ ] `NO_PROXY=localhost,127.0.0.1` 已设置（如有 HTTP 代理环境）

## 常见错误诊断

### Gateway 连接失败

```bash
# 检查 Gateway 日志
docker compose logs gateway --tail 50
# 或（打包部署）
docker compose -f docker-compose.package.yml logs gateway --tail 50
# 或（裸机）
journalctl -u openclaw-gateway --no-pager -n 50

# 常见原因:
# - OPENCLAW_GATEWAY_TOKEN 不匹配 → 检查 .env 和 seed 注入结果
# - 端口冲突 → lsof -i :18789
# - 配置格式错误 → 检查 data/gateway/openclaw.json
# - controlUi 错误 → 确认 openclaw.json 有 controlUi.dangerouslyAllowHostHeaderOriginFallback
```

### NOT_PAIRED 设备配对失败

```bash
# Docker 模式下 Deck 必须通过 localhost 连接 Gateway（共享网络）
# 检查 docker-compose.yml 中 deck service:
#   network_mode: "service:gateway"
#   DECK_GATEWAY_URL: ws://localhost:18789

# 如果使用独立网络（非共享模式），需要手动完成 onboarding 配对
```

### Deck 白屏或 500

```bash
# 检查 Deck 日志
docker compose logs deck --tail 50

# 常见原因:
# - better-sqlite3 native addon 缺失 → 重新构建 Deck 镜像
# - DECK_GATEWAY_URL 错误 → 共享网络模式应为 ws://localhost:18789
# - migrations 目录缺失 → 检查 Dockerfile COPY 步骤
```

### Sandbox 不工作

```bash
# 检查 sandbox 镜像
docker images | grep sandbox

# 如果没有镜像（打包部署会自动包含）:
docker build -f Dockerfile.sandbox -t openclaw-sandbox:bookworm-slim .
docker build -f Dockerfile.sandbox-common --build-arg BASE_IMAGE=openclaw-sandbox:bookworm-slim -t openclaw-sandbox:common .

# 检查 docker.sock 权限
ls -la /var/run/docker.sock
# DOCKER_GID 应匹配 socket 的 group ID
```

### 插件或 skills 缺失

```bash
# 确认打包时使用了 --with-local
# 检查 seed 目录
ls deploy/seed/extensions/
ls deploy/seed/skills/

# 手动重新注入 seed
deploy/scripts/seed.sh ./data/gateway --force
```

## 配置修改后操作

```bash
# 修改 .env 后（Docker 本地构建）
cd deploy && docker compose up -d

# 修改 .env 后（Docker 打包部署）
cd deploy && docker compose -f docker-compose.package.yml up -d

# 修改 seed 后需重新注入
./scripts/seed.sh ./data/gateway --force
docker compose restart gateway

# 修改源码后需重新构建
docker compose up -d --build

# 裸机模式修改后
sudo systemctl restart openclaw-gateway openclaw-deck
```

## 日志位置

| 模式 | Gateway 日志 | Deck 日志 |
|------|-------------|-----------|
| Docker 本地构建 | `docker compose logs -f gateway` | `docker compose logs -f deck` |
| Docker 打包部署 | `docker compose -f docker-compose.package.yml logs -f gateway` | `docker compose -f docker-compose.package.yml logs -f deck` |
| 裸机 | `journalctl -u openclaw-gateway -f` | `journalctl -u openclaw-deck -f` |

## 重要约束

- Gateway 必须从源码构建（增强 fork 包含自定义 RPC handlers）
- 不要使用全局安装的 `openclaw` 命令
- Docker 模式下 Deck 与 Gateway 共享网络（`network_mode: service:gateway`），通过 localhost 自动配对
- Docker 模式下 Gateway 使用 `--bind lan`（容器内对外通信需要）
- 裸机模式下 Gateway 使用 `--bind loopback`（安全）
- `deploy/.env` 包含敏感信息，不要提交到 git
- 种子中的 `openclaw.json.tmpl` 必须包含 `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback: true`
