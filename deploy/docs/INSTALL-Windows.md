# OpenClaw Windows 安装指南

## 前置依赖

按以下顺序安装（离线包在 `deps/` 目录下，联网环境可直接下载）：

### 1. Git for Windows（必须）

提供 Git Bash 环境，用于运行安装脚本。

- 离线：运行 `deps/git/Git-*-64-bit.exe`
- 联网：https://git-scm.com/download/win

安装时使用默认选项即可。

### 2. Node.js 22+（必须）

- 离线：运行 `deps/node/node-*-x64.msi`（ARM 设备用 `*-arm64.msi`）
- 联网：https://nodejs.org/

安装完成后打开 PowerShell，运行：

```powershell
npm install -g pnpm pm2
```

### 3. Docker Desktop（可选，仅 Docker 模式需要）

- 离线：运行 `deps/docker/DockerDesktopInstaller.exe`
- 联网：https://www.docker.com/products/docker-desktop/
- 需要先启用 WSL 2：`wsl --install`（然后重启）

## 安装步骤

### 1. 解压安装包

用 7-Zip 或 Git Bash 解压：

```bash
tar xzf openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
```

### 2. 配置环境变量

打开 Git Bash（右键安装包目录 → "Git Bash Here"）：

```bash
cp source/deploy/.env.example source/deploy/.env
vim source/deploy/.env
```

至少配置一个 AI Provider 的 API Key（如 `CPA_API_KEY` + `CPA_BASE_URL`）。

### 3. 安装运行时依赖

```bash
cd source
pnpm install --frozen-lockfile
```

### 4. 运行安装脚本

```bash
bash deploy/scripts/install.sh bare-metal
```

### 5. 验证

```bash
pm2 status
curl -s http://localhost:18789/healthz
```

浏览器打开 **http://localhost:3000**，输入 `.env` 中 `OPENCLAW_GATEWAY_TOKEN` 的值完成配对。

## 日常管理

```bash
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 restart all     # 重启服务
pm2 stop all        # 停止服务
```

## 常见问题

| 问题 | 解决 |
|------|------|
| `bash: command not found` | 安装 Git for Windows，使用 Git Bash |
| `pnpm: command not found` | 运行 `npm install -g pnpm` |
| 端口被占用 | `netstat -ano \| findstr :18789`，用 `taskkill /PID <pid> /F` 杀掉 |
| Gateway 重启循环 | `pm2 kill && taskkill /F /IM node.exe`，然后重新启动 |
| 供应商显示未配置 | 功能正常可用，这是显示问题（auth profile 已通过 seed 初始化） |
