# OpenClaw Windows 安装指南

## 前置依赖

推荐直接使用 **PowerShell** 安装。Node.js 与 pnpm 由安装脚本自动处理，运行时改为 **Scheduled Task / Startup fallback**。

- **Git for Windows 不是必需的**
- 只有在你要使用旧的 shell fallback / Docker-on-Windows shell 工作流时，才需要安装 Git Bash
- 离线 Git 安装包仍会随 `deps/` 提供，作为可选兜底

> **Docker 模式**（可选）：如需使用 Docker 部署，还需安装 Docker Desktop 并启用 WSL 2。

## 一键安装

### 1. 解压安装包

用 7-Zip、资源管理器，或 PowerShell 解压：

```powershell
tar xzf openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
```

### 2. 运行安装

**方式 A（推荐）**：PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**方式 B**：双击 `install.bat`

**方式 C（兼容旧流程）**：Git Bash / `install.sh`

安装脚本会自动：

- 安装 Node.js 22+（如缺失，通过 winget 或提示安装离线 MSI）
- 安装 pnpm
- 从 `.env.example` 创建 `.env`（API Key 和 Token 已预填）
- 构建 Gateway 和 Deck
- 安装 Windows 启动服务（优先 Scheduled Task，失败时回退到 Startup 登录项）
- 启动服务

### 3. 验证

双击 `status.bat`，或：

```powershell
powershell -ExecutionPolicy Bypass -File .\status.ps1
```

浏览器打开 **http://localhost:3000** 即可使用 Deck Dashboard。

## 日常运维

双击对应的 `.bat` 文件，或在 PowerShell 中运行：

| 操作     | 双击         | PowerShell     |
| -------- | ------------ | -------------- |
| 查看状态 | `status.bat` | `.\status.ps1` |
| 启动     | `start.bat`  | `.\start.ps1`  |
| 停止     | `stop.bat`   | `.\stop.ps1`   |

底层 Windows 服务（高级用户）：

```powershell
schtasks /Query /TN "OpenClaw Deploy" /V /FO LIST
taskkill /PID <pid> /T /F
```

## 增量更新

收到新版安装包后，在 PowerShell 中执行：

```powershell
# 预览变更
.\update.ps1 -Package C:\path\to\openclaw-deploy-NEW.tar.gz -DryRun

# 执行更新（自动备份数据、替换代码、重启服务）
.\update.ps1 -Package C:\path\to\openclaw-deploy-NEW.tar.gz
```

用户数据（配置、会话、API key）会自动保留。如需回滚，当前备份保存在 `.backup/` 目录下。

## 自定义配置

如需修改 API Key 或其他配置：

```powershell
notepad .\source\deploy\.env
.\stop.ps1
.\start.ps1
```

## 常见问题

| 问题                    | 解决                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `powershell` 脚本被拦截 | 改用 `-ExecutionPolicy Bypass` 启动命令                                             |
| 端口被占用              | `netstat -ano \| findstr :18789`，用 `taskkill /PID <pid> /T /F` 杀掉               |
| Gateway / Deck 重启循环 | 查看 `deploy/data/logs/` 下的 `windows-supervisor.log` / `gateway.log` / `deck.log` |
| 供应商显示未配置        | 功能正常可用，这是显示问题（auth profile 已通过 seed 初始化）                       |

## Docker-on-Windows 说明

当前 PowerShell 路径只覆盖 **Windows bare-metal（Scheduled Task / Startup fallback）**。

如果你要在 Windows 上继续使用 Docker shell 工作流，仍可走旧的 `install.sh docker` 路径；这时 Git Bash 仍然是可选兼容依赖。

## 一条命令远程安装

如果维护者已经发布了 bootstrap 资产，Windows 用户可以直接执行：

```powershell
iwr -useb http://<your-host>:8088/<release-label>/install.ps1 | iex
```

这个 bootstrap 会：

- 下载 `windows-latest.json`
- 下载最新 `openclaw-deploy-*.tar.gz`
- 首次安装时自动解包到固定安装目录
- 已安装时自动走更新路径

重复执行同一条命令即可更新。

> 这个 bootstrap 必须由**独立静态文件端口**提供，不能直接复用 Deck 的 `3340`。

> 维护者说明：要发布真正的 Windows 自包含包，优先使用同平台环境打包：
>
> - `deploy/scripts/package.sh --windows-self-contained`
> - 或先产出 `--with-prebuilt` 包，再在 Windows 机器上执行 `deploy/package-self-contained.ps1` 给 tar.gz 增补 `source/node_modules`
