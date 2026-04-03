# OpenClaw macOS 安装指南

## 一键安装

安装脚本会自动处理所有依赖（通过 Homebrew 安装 Node.js，再装 pnpm/PM2），API Key 和 Token 已预填。

前提：已安装 Homebrew（https://brew.sh）。

```bash
tar xzf openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
bash install.sh bare-metal
```

Docker 模式：

```bash
brew install --cask docker   # 安装 Docker Desktop（如未安装）
bash install.sh docker
```

## 验证

```bash
bash status.sh
```

浏览器打开 **http://localhost:3000** 即可使用。

## 日常运维

```bash
bash status.sh      # 查看状态（含健康检查）
bash start.sh       # 启动服务
bash stop.sh        # 停止服务
```

底层命令（高级用户）：

```bash
# PM2 模式
pm2 status && pm2 logs && pm2 startup

# Docker 模式
cd source/deploy/docker
docker compose --env-file ../.env ps
docker compose --env-file ../.env logs -f
```

## 增量更新

```bash
# 预览变更
bash deploy/scripts/update.sh /path/to/openclaw-deploy-NEW.tar.gz --dry

# 执行更新
bash deploy/scripts/update.sh /path/to/openclaw-deploy-NEW.tar.gz
```

用户数据自动保留，支持回滚（备份在 `.backup-*` 目录下）。

## 自定义配置

```bash
vim source/deploy/.env
bash stop.sh && bash start.sh
```

## 常见问题

| 问题         | 解决                                                               |
| ------------ | ------------------------------------------------------------------ |
| 端口被占用   | `lsof -i :18789`                                                   |
| NOT_PAIRED   | Docker: 确认 `network_mode: service:gateway`；裸机: 确认 localhost |
| PM2 启动失败 | `pm2 logs` 查看错误                                                |
