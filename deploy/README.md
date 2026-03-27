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
