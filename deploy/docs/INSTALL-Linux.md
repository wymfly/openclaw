# OpenClaw Linux 安装指南

## 前置依赖

### 裸机模式

```bash
# Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm + pm2
npm install -g pnpm pm2
```

### Docker 模式

```bash
# Docker + Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

## 安装步骤

### 1. 解压安装包

```bash
tar xzf openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
```

### 2. 配置环境变量

```bash
cp source/deploy/.env.example source/deploy/.env
vim source/deploy/.env
```

至少配置一个 AI Provider 的 API Key（如 `CPA_API_KEY` + `CPA_BASE_URL`）。

### 3. 安装运行时依赖（裸机模式）

```bash
cd source
pnpm install --frozen-lockfile
```

### 4. 运行安装脚本

```bash
# 交互式选择
bash deploy/scripts/install.sh

# 或直接指定模式
bash deploy/scripts/install.sh bare-metal   # 裸机 + PM2
bash deploy/scripts/install.sh docker       # Docker Compose
```

### 5. 验证

```bash
curl -s http://localhost:18789/healthz   # Gateway
curl -s http://localhost:3000            # Deck
```

浏览器打开 **http://localhost:3000**，输入 `.env` 中 `OPENCLAW_GATEWAY_TOKEN` 的值完成配对。

## 日常管理

### 裸机模式（PM2）

```bash
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 restart all     # 重启服务
pm2 stop all        # 停止服务
pm2 startup         # 开机自启
```

### Docker 模式

```bash
cd source/deploy/docker
docker compose --env-file ../.env ps          # 查看状态
docker compose --env-file ../.env logs -f     # 查看日志
docker compose --env-file ../.env restart     # 重启
docker compose --env-file ../.env down        # 停止
```

## 常见问题

| 问题 | 解决 |
|------|------|
| 端口被占用 | `lsof -i :18789` 或 `ss -ltnp \| grep 18789` |
| NOT_PAIRED 配对失败 | Docker: 确认 `network_mode: service:gateway`；裸机: 确认 localhost 可访问 |
| PM2 启动失败 | `pm2 logs` 查看错误 |
| Docker 构建慢 | 首次需下载依赖，后续利用缓存 |
