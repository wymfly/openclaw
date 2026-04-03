# OpenClaw 快速安装

## 一键安装

安装脚本会自动处理所有依赖（Node.js、pnpm、PM2），无需手动安装。

API Key 和 Gateway Token 已预填，无需手动编辑配置文件。

```bash
cd deploy
bash install.sh bare-metal
```

Windows 用户：双击 `install.bat`。

安装完成后：

- Gateway: http://localhost:18789/healthz
- Deck Dashboard: http://localhost:3000

## 运维

```bash
cd deploy
bash status.sh    # 查看状态
bash start.sh     # 启动
bash stop.sh      # 停止
```

Windows 用户：双击 `status.bat` / `start.bat` / `stop.bat`。

## 安装包模式

如果是从打包产物（tar.gz）安装：

```bash
tar xzf openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
bash install.sh bare-metal

# 运维
bash status.sh
bash start.sh
bash stop.sh
```

## 其他安装模式

```bash
bash install.sh              # 交互式菜单
bash install.sh docker       # Docker 模式
bash install.sh docker-build # Docker 模式（强制重建）
bash install.sh bare-metal   # 裸机模式（PM2）
```

## 自定义配置

如需修改 API Key 或其他配置：

```bash
vim deploy/.env              # 编辑配置
bash deploy/stop.sh && bash deploy/start.sh   # 重启生效
```

## 常见问题

1. **端口被占用** — `lsof -i :18789` / `lsof -i :3000` 找到占用进程
2. **Gateway token 不匹配** — 检查 `.env` 中 `OPENCLAW_GATEWAY_TOKEN` 和 seed 配置一致
3. **Docker 构建慢** — 首次构建需下载依赖，后续利用缓存
4. **Deck 无法连接 Gateway** — Docker 模式需 `network_mode: service:gateway`

详细文档见 [deploy/README.md](README.md)。
