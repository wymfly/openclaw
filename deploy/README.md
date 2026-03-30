# OpenClaw + Deck 部署指南

部署 OpenClaw Gateway 和 Deck Dashboard，支持三种模式。

## 打包部署到其他机器（推荐）

```bash
# 在开发机上打包（构建镜像 + 打包源码）
deploy/scripts/package.sh

# 包含本机已安装的插件和自定义 skills
deploy/scripts/package.sh --with-local

# 仅 Docker 镜像（更小，目标机器只需 Docker）
deploy/scripts/package.sh --docker-only --with-local

# 仅源码（裸机部署用）
deploy/scripts/package.sh --source-only --with-local
```

生成 `openclaw-deploy-YYYYMMDD-HHMMSS.tar.gz`，传输到目标机器后：

```bash
tar xzf openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
./install.sh              # 交互式
./install.sh docker       # Docker 模式（使用预构建镜像，无需编译）
./install.sh bare-metal   # 裸机模式（从源码构建）
```

### --with-local 收集的内容

| 内容 | 来源 | 部署行为 |
|------|------|---------|
| 运行时插件 | `~/.openclaw/extensions/` | 首次部署写入，不覆盖已修改的 |
| 自定义 skills | `~/.openclaw/skills/` | 每次部署/升级都同步 |
| 插件启用配置 | `openclaw.json` plugins 段 | 合并到目标配置 |

## 快速开始（本地开发机直接部署）

### Docker 部署

```bash
cd deploy
cp .env.example .env
vim .env                    # 填写 API keys
./scripts/setup.sh docker   # 构建并启动
```

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

Docker 模式下 Deck 与 Gateway 共享网络命名空间（`network_mode: service:gateway`），通过 localhost 通信，自动完成 Ed25519 设备配对。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 至少一个 | DeepSeek API Key |
| `ANTHROPIC_API_KEY` | 至少一个 | Anthropic API Key |
| `OPENAI_API_KEY` | 至少一个 | OpenAI API Key |
| `OPENCLAW_GATEWAY_TOKEN` | 自动生成 | Gateway 认证 token |
| `DEFAULT_MODEL` | 否 | 默认模型（默认 `deepseek/deepseek-chat`） |
| `GATEWAY_PORT` | 否 | Gateway 端口（默认 18789） |
| `DECK_PORT` | 否 | Deck 端口（默认 3000） |
| `TZ` | 否 | 时区（默认 `Asia/Shanghai`） |
| `OPENCLAW_SANDBOX` | 否 | 设为 1 启用 sandbox |
| `DOCKER_GID` | sandbox | Docker socket GID |

## 管理命令

```bash
# Docker（本地构建部署）
./scripts/setup.sh status          # 查看状态
./scripts/setup.sh stop            # 停止
docker compose logs -f gateway     # Gateway 日志
docker compose logs -f deck        # Deck 日志
docker compose up -d --build       # 重新构建并启动

# Docker（打包部署，使用 package compose）
docker compose -f docker-compose.package.yml logs -f
docker compose -f docker-compose.package.yml restart
docker compose -f docker-compose.package.yml down

# 裸机
systemctl status openclaw-gateway  # Gateway 状态
systemctl status openclaw-deck     # Deck 状态
journalctl -u openclaw-gateway -f  # Gateway 日志
journalctl -u openclaw-deck -f     # Deck 日志
sudo systemctl restart openclaw-gateway openclaw-deck  # 重启
```

## 种子定制

`seed/` 目录包含预置配置，部署时自动注入：

- `seed/openclaw.json.tmpl` — 主配置模板（模型、agent、通道、gateway controlUi）
- `seed/agents/` — 预置 agent 定义
- `seed/cron/jobs.json` — 预置定时任务
- `seed/extensions/` — 预置插件（`--with-local` 自动收集或手动添加）
- `seed/skills/` — 自定义 skills（`--with-local` 自动收集或手动添加）
- `seed/plugins-config.json` — 插件启用配置（合并到 openclaw.json）

修改种子后重新部署即可生效。详见 `seed/README.md`。

## 升级

### Docker（打包部署）

在开发机上重新打包并传输：
```bash
deploy/scripts/package.sh --with-local
# 传输新包到目标机器
# 在目标机器上:
./install.sh docker
```

### Docker（本地构建）

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

Gateway 和 Deck 可以部署在不同机器上。注意：分离部署时无法使用共享网络模式，需要手动配对设备。

1. 在 Gateway 机器上只启动 gateway 服务
2. 在 Deck 机器上修改 `.env`：
   ```
   DECK_GATEWAY_URL=ws://<gateway-host>:18789
   ```
3. Gateway 需要 `--bind lan`（Docker 默认已配置）
4. 首次连接通过 Deck onboarding 向导完成设备配对

## 故障排查

| 问题 | 排查 |
|------|------|
| Deck 无法连接 Gateway | 检查 `DECK_GATEWAY_URL` 和 `DECK_GATEWAY_TOKEN` |
| NOT_PAIRED 错误 | Docker: 确认 Deck 使用 `network_mode: service:gateway`；裸机: Gateway 绑 loopback |
| controlUi allowedOrigins 错误 | 确认 `openclaw.json` 包含 `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback: true` |
| Gateway 启动失败 | 检查端口占用：`lsof -i :18789` |
| Docker 构建 OOM | 增加 Docker 内存或添加 `NODE_OPTIONS=--max-old-space-size=2048` |
| Sandbox 无法启动 | 检查 docker.sock 权限和 DOCKER_GID |
| 首次访问 Deck 白屏 | 等待 Gateway 健康检查通过后刷新 |
| 打包后插件缺失 | 确认使用了 `--with-local` 参数打包 |

## 清理

```bash
./scripts/teardown.sh docker      # 删除 Docker 容器和镜像
./scripts/teardown.sh bare-metal  # 删除 systemd 服务
./scripts/teardown.sh all         # 删除所有（含数据）
```

## 脚本索引

| 脚本 | 用途 |
|------|------|
| `scripts/setup.sh` | 统一部署入口（本地构建模式） |
| `scripts/package.sh` | 打包部署包（跨机器部署） |
| `scripts/seed.sh` | 种子数据注入 |
| `scripts/teardown.sh` | 清理卸载 |
| `bare-metal/install.sh` | 裸机安装（systemd） |
