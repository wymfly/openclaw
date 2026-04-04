# OpenClaw Windows 安装指南

## 前置依赖

只需安装 Git for Windows（提供 Git Bash 环境）。其他依赖（Node.js、pnpm、PM2）由安装脚本自动处理。

- 离线：运行 `deps/git/Git-*-64-bit.exe`
- 联网：https://git-scm.com/download/win

安装时使用默认选项即可。

> **Docker 模式**（可选）：如需使用 Docker 部署，还需安装 Docker Desktop 并启用 WSL 2。

## 一键安装

### 1. 解压安装包

用 7-Zip 或 Git Bash 解压：

```bash
tar xzf openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
```

### 2. 运行安装

**方式 A**：双击 `install.bat`

**方式 B**：打开 Git Bash（右键安装包目录 → "Git Bash Here"）：

```bash
bash install.sh bare-metal
```

安装脚本会自动：

- 安装 Node.js 22+（如缺失，通过 winget 或提示安装离线 MSI）
- 安装 pnpm 和 PM2
- 从 `.env.example` 创建 `.env`（API Key 和 Token 已预填）
- 构建 Gateway 和 Deck
- 启动服务

### 3. 验证

双击 `status.bat`，或：

```bash
bash status.sh
```

浏览器打开 **http://localhost:3000** 即可使用 Deck Dashboard。

## 日常运维

双击对应的 `.bat` 文件，或在 Git Bash 中运行：

| 操作     | 双击         | Git Bash         |
| -------- | ------------ | ---------------- |
| 查看状态 | `status.bat` | `bash status.sh` |
| 启动     | `start.bat`  | `bash start.sh`  |
| 停止     | `stop.bat`   | `bash stop.sh`   |

底层 PM2 命令（高级用户）：

```bash
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 startup         # 设置开机自启
```

## 增量更新

收到新版安装包后，在 Git Bash 中执行：

```bash
# 预览变更
bash deploy/scripts/update.sh /d/path/to/openclaw-deploy-NEW.tar.gz --dry

# 执行更新（自动备份数据、替换代码、重启服务）
bash deploy/scripts/update.sh /d/path/to/openclaw-deploy-NEW.tar.gz
```

用户数据（配置、会话、API key）会自动保留。如需回滚，备份在 `.backup-*` 目录下。

## 自定义配置

如需修改 API Key 或其他配置：

```bash
vim source/deploy/.env       # 编辑配置
bash stop.sh && bash start.sh   # 重启生效
```

## 常见问题

| 问题                      | 解决                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `bash: command not found` | 安装 Git for Windows，使用 Git Bash                                |
| 端口被占用                | `netstat -ano \| findstr :18789`，用 `taskkill /PID <pid> /F` 杀掉 |
| Gateway 重启循环          | `pm2 kill && taskkill /F /IM node.exe`，然后重新启动               |
| 供应商显示未配置          | 功能正常可用，这是显示问题（auth profile 已通过 seed 初始化）      |
