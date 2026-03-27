# Deploy — Claude Code 操作指引

本文件指导 Claude Code 如何执行 OpenClaw + Deck 的部署操作。

## 部署架构

- Gateway（:18789）: OpenClaw 核心，源码构建
- Deck（:3000）: Next.js standalone dashboard
- 连接: Deck → Gateway via WebSocket（`DECK_GATEWAY_URL`）
- 认证: `OPENCLAW_GATEWAY_TOKEN` + Ed25519 device identity

## 关键文件

| 文件 | 用途 |
|------|------|
| `deploy/scripts/setup.sh` | 统一部署入口 |
| `deploy/scripts/seed.sh` | 种子数据注入 |
| `deploy/docker-compose.yml` | Docker 编排 |
| `deploy/docker-compose.sandbox.yml` | Sandbox overlay |
| `deploy/Dockerfile.deck` | Deck 镜像构建 |
| `deploy/bare-metal/install.sh` | 裸机安装 |
| `deploy/.env` | 环境配置（从 .env.example 复制） |

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

| 模式 | Gateway 日志 | Deck 日志 |
|------|-------------|-----------|
| Docker | `docker compose logs -f gateway` | `docker compose logs -f deck` |
| 裸机 | `journalctl -u openclaw-gateway -f` | `journalctl -u openclaw-deck -f` |

## 重要约束

- Gateway 必须从源码构建（增强 fork 包含自定义 RPC handlers）
- 不要使用全局安装的 `openclaw` 命令
- Docker 模式下 Gateway 使用 `--bind lan`（容器间通信需要）
- 裸机模式下 Gateway 使用 `--bind loopback`（安全）
- `deploy/.env` 包含敏感信息，不要提交到 git
