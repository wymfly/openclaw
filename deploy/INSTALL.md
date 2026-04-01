# OpenClaw 快速安装

## 前置依赖

### Docker 模式（推荐）

| 平台    | 依赖                   | 安装                                                                  |
| ------- | ---------------------- | --------------------------------------------------------------------- |
| Linux   | Docker + Compose v2    | `curl -fsSL https://get.docker.com \| sh`                             |
| macOS   | Docker Desktop         | `brew install --cask docker`                                          |
| Windows | Docker Desktop + WSL 2 | [docker.com/desktop](https://www.docker.com/products/docker-desktop/) |

### 裸机模式

| 平台    | 依赖              | 安装                                                                                  |
| ------- | ----------------- | ------------------------------------------------------------------------------------- |
| Linux   | Node.js 22+, pnpm | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && npm i -g pnpm` |
| macOS   | Node.js 22+, pnpm | `brew install node@22 && npm i -g pnpm`                                               |
| Windows | Node.js 22+, pnpm | [nodejs.org](https://nodejs.org/) + `npm i -g pnpm`                                   |

## 安装步骤

### Step 1: 配置

```bash
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env，至少设置一个 AI Provider API Key
```

### Step 2: 安装

```bash
# 交互式
bash deploy/scripts/install.sh

# 或指定模式
bash deploy/scripts/install.sh docker       # Docker
bash deploy/scripts/install.sh bare-metal   # 裸机 + PM2
```

### Step 3: 验证

- Gateway: http://localhost:18789/healthz
- Deck Dashboard: http://localhost:3000

## 管理

### Docker

```bash
cd deploy/docker
docker compose --env-file ../.env ps       # 状态
docker compose --env-file ../.env logs -f  # 日志
docker compose --env-file ../.env restart  # 重启
docker compose --env-file ../.env down     # 停止
```

### 裸机 (PM2)

```bash
pm2 status        # 状态
pm2 logs          # 日志
pm2 restart all   # 重启
pm2 stop all      # 停止
```

## 常见问题

1. **端口被占用** — `lsof -i :18789` / `lsof -i :3000` 找到占用进程
2. **Gateway token 不匹配** — 检查 `.env` 中 `OPENCLAW_GATEWAY_TOKEN` 和 seed 配置一致
3. **Docker 构建慢** — 首次构建需下载依赖，后续利用缓存
4. **Deck 无法连接 Gateway** — Docker 模式需 `network_mode: service:gateway`
5. **No API Key** — `.env` 中至少设置一个 Provider API Key

详细文档见 [deploy/README.md](README.md)。
