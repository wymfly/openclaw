# OpenClaw Deploy

OpenClaw Gateway + Deck Dashboard 的统一部署方案。

## 架构

```
Browser ──→ Deck(:3000) ──ws──→ Gateway(:18789) ──→ AI Providers
                ↓                       ↓
          JSON files            .openclaw/ (config/agents/sessions)
```

- **Gateway** — OpenClaw 核心引擎，处理 AI 调用、工具执行、会话管理
- **Deck** — Next.js Web 仪表板，通过 WebSocket 连接 Gateway
- **WeCom 插件** — 企业微信频道插件（`extensions/wecom`），已内置并默认启用
- Docker 模式下 Deck 与 Gateway 共享网络命名空间，通过 localhost 自动完成设备配对

## 部署模式

| 模式         | 适用场景                     | 依赖                |
| ------------ | ---------------------------- | ------------------- |
| Docker       | 推荐。隔离环境，一键部署     | Docker + Compose v2 |
| Docker Build | 同上，强制重建镜像           | Docker + Compose v2 |
| 裸机         | 开发环境、无 Docker 的服务器 | Node.js 22+, pnpm   |

## 快速开始（一键安装）

```bash
cd deploy

# 一键安装（自动创建 .env、安装 Node.js/pnpm、构建、启动）
bash install.sh bare-metal

# 验证
bash status.sh
```

Windows bare-metal 推荐改用 PowerShell（安装后由 Scheduled Task / Startup fallback 托管）：

```powershell
cd deploy
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

如果你把 bootstrap 资产发布到**独立 HTTP 端口**，最终的一条命令可以是：

```powershell
iwr -useb http://<your-host>:8088/<release-label>/install.ps1 | iex
```

维护者/后续 agent 接手说明见：

```text
deploy/HANDOFF.md
```

### Windows 用户速查

默认安装路径：

```text
%LOCALAPPDATA%\OpenClawDeploy
```

安装 / 更新：

```powershell
iwr -useb http://<your-host>:8088/<release-label>/install.ps1 | iex
```

手动启停 / 查看状态：

```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\OpenClawDeploy\start.ps1"
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\OpenClawDeploy\stop.ps1"
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\OpenClawDeploy\status.ps1"
```

也可以直接双击安装目录里的：

- `start.bat`
- `stop.bat`
- `status.bat`

### 自定义安装目录

如果你不想安装到默认的 `%LOCALAPPDATA%\OpenClawDeploy`，可以显式传 `-InstallRoot`：

```powershell
& ([scriptblock]::Create((iwr -useb http://<your-host>:8088/<release-label>/install.ps1))) -InstallRoot D:\OpenClawDeploy
```

之后手动启停也改为使用你指定的目录，例如：

```powershell
powershell -ExecutionPolicy Bypass -File "D:\OpenClawDeploy\start.ps1"
powershell -ExecutionPolicy Bypass -File "D:\OpenClawDeploy\stop.ps1"
powershell -ExecutionPolicy Bypass -File "D:\OpenClawDeploy\status.ps1"
```

API Key 和 Gateway Token 已在 `.env.example` 中预填，无需手动编辑。

如需自定义配置，安装后编辑 `.env` 然后重启：

```bash
vim .env
bash stop.sh && bash start.sh
```

## 打包（跨机器部署）

```bash
# A-layer: 仅源码 (~50MB)
deploy/scripts/package.sh

# A+C: 源码 + 预构建产物 (~60MB)
deploy/scripts/package.sh --with-prebuilt

# Windows 自包含包（预构建 + source/node_modules，需在同平台环境打包）
deploy/scripts/package.sh --windows-self-contained

# A+B: 源码 + Docker 镜像 (~800MB)
deploy/scripts/package.sh --with-images --platform linux

# A+B+C: 全部
deploy/scripts/package.sh --full --platform linux

# 收集本地插件和 skills
deploy/scripts/package.sh --with-local

# 包含 Windows 离线安装包（Node.js MSI + Docker Desktop）
deploy/scripts/prepare-deps.sh   # 先下载依赖
deploy/scripts/package.sh --with-deps

# 额外生成可托管的一条命令 Windows bootstrap 资产
deploy/scripts/package.sh --bootstrap-base-url https://<your-host>/windows

# 给已有 tar.gz 增补 Windows source/node_modules（适合在 Windows 服务器上补全发布物）
powershell -ExecutionPolicy Bypass -File .\\deploy\\package-self-contained.ps1 -BasePackage .\\openclaw-deploy-*.tar.gz -NodeModulesPath .\\node_modules -BootstrapBaseUrl https://<your-host>/windows
```

### 打包层说明

| 层           | 内容                           | 大小       | 用途                                             |
| ------------ | ------------------------------ | ---------- | ------------------------------------------------ |
| A (source)   | 源码 + 部署脚本 + seed         | ~50MB      | 始终包含                                         |
| B (images)   | Docker 镜像 (.tar.gz)          | ~800MB     | 离线 Docker 部署（建议在目标机构建）             |
| C (prebuilt) | Gateway dist + Deck standalone | ~10MB      | 跳过裸机构建                                     |
| node_modules | Runtime 依赖                   | 视环境而定 | Windows 同平台自包含发布                         |
| deps         | Windows 离线安装包             | ~675MB     | Node.js MSI + Docker Desktop + 可选 Git fallback |

### Windows 离线部署

提前下载 Windows 依赖，避免目标机下载缓慢：

```bash
# 下载全部（Node.js + Docker Desktop + 可选 Git fallback）
deploy/scripts/prepare-deps.sh

# 仅 Node.js（~60MB）
deploy/scripts/prepare-deps.sh --node-only

# 打包时带上
deploy/scripts/package.sh --with-prebuilt --with-deps
```

安装包内 `deps/` 目录包含 MSI/EXE 安装程序。Windows bare-metal 优先运行 `install.ps1`；Git for Windows 仅作为兼容 shell fallback。

### 部署安装包

Windows 目标机：

```powershell
tar xzf .\openclaw-deploy-*.tar.gz
cd .\openclaw-deploy-*
powershell -ExecutionPolicy Bypass -File .\install.ps1

.\status.ps1
.\start.ps1
.\stop.ps1
```

### Windows 一条命令分发

如果你要把 Windows 包发布到静态 HTTP 目录：

1. 运行：

```bash
deploy/scripts/package.sh --with-prebuilt --bootstrap-base-url https://<your-host>/windows --output /path/to/publish-dir
```

如果你要发布给 Windows 用户的一键自包含包，优先在 Windows 对应运行时环境使用：

```bash
deploy/scripts/package.sh --windows-self-contained --bootstrap-base-url http://<your-host>:8088/<release-label> --output /path/to/publish-dir
```

或者先产出普通 `--with-prebuilt` 包，再在 Windows 机器上执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\package-self-contained.ps1 -BasePackage .\openclaw-deploy-*.tar.gz -NodeModulesPath .\node_modules -BootstrapBaseUrl http://<your-host>:8088/<release-label>
```

2. 输出目录会多出：
   - `install.ps1` — hostable bootstrap installer
   - `windows-latest.json` — latest package manifest
   - `openclaw-deploy-*.tar.gz` — deploy package

3. 把这三个文件发布到同一个 HTTP 目录后，Windows 用户即可执行：

```powershell
iwr -useb http://<your-host>:8088/<release-label>/install.ps1 | iex
```

重复执行同一条命令即可走更新路径。

### Windows 发布 HTTP 端口

Windows 安装资产不要复用 Deck 的 `3340`，也不要依赖默认 `80/443`。请为 `publish/` 单独启动一个静态文件端口，例如 `8088`：

```powershell
cd deploy
.\serve-release-http.cmd
```

默认发布根目录：

```text
deploy/publish/
```

## 环境变量

| 变量                     | 必填     | 默认值                 | 说明              |
| ------------------------ | -------- | ---------------------- | ----------------- |
| `CPA_API_KEY`            | \*       |                        | CPA API Key       |
| `CPA_BASE_URL`           | \*       |                        | CPA Base URL      |
| `DEEPSEEK_API_KEY`       | \*       |                        | DeepSeek API Key  |
| `ANTHROPIC_API_KEY`      | \*       |                        | Anthropic API Key |
| `OPENAI_API_KEY`         | \*       |                        | OpenAI API Key    |
| `OPENCLAW_GATEWAY_TOKEN` | 自动生成 |                        | Gateway 认证令牌  |
| `DEFAULT_MODEL`          |          | `cpa/deepseek-chat`    | 默认 AI 模型      |
| `GATEWAY_PORT`           |          | `18789`                | Gateway 端口      |
| `DECK_PORT`              |          | `3000`                 | Deck 端口         |
| `TZ`                     |          | `Asia/Shanghai`        | 时区              |
| `OPENCLAW_STATE_DIR`     |          | `./data/.openclaw`     | Gateway 数据目录  |
| `DECK_DATA_DIR`          |          | `./data/openclaw-deck` | Deck 数据库目录   |

\* 至少配置一个 AI Provider

## 数据目录结构

```
deploy/data/
  .openclaw/              # Gateway 状态 (config, agents, sessions, logs)
    openclaw.json         # 主配置文件
    agents/main/          # Agent 目录
    cron/jobs.json        # 定时任务
  openclaw-deck/          # Deck 数据
    *.json                # JSON 配置和状态文件（运行时自动创建）
```

## 种子定制

`deploy/seed/` 目录包含初始数据模板：

| 文件/目录            | 策略        | 说明                            |
| -------------------- | ----------- | ------------------------------- |
| `openclaw.json.tmpl` | init-once   | 配置模板，`${VAR}` 变量自动替换 |
| `agents/`            | init-once   | Agent 目录结构                  |
| `cron/jobs.json`     | init-once   | 定时任务                        |
| `extensions/`        | init-once   | 扩展插件                        |
| `skills/`            | always-sync | Skills（每次运行覆盖）          |

**策略说明**：

- **init-once** — 首次 seed 时创建，之后不覆盖（保护用户修改）
- **always-sync** — 每次 seed 都覆盖（保持最新）
- `--force` 参数可强制全量重新 seed

## 运维命令

```bash
cd deploy
bash status.sh             # 状态（含健康检查）
bash start.sh              # 启动
bash stop.sh               # 停止
```

Windows 用户可以双击 `start.bat` / `stop.bat` / `status.bat`。

脚本会自动检测运行模式（Docker / PM2）。也可以显式指定：

```bash
bash start.sh docker       # 强制 Docker 模式
bash start.sh pm2          # 强制 PM2 模式
```

### 底层命令（高级用户）

Docker 模式:

```bash
cd deploy/docker
docker compose --env-file ../.env ps
docker compose --env-file ../.env logs -f
```

PM2 模式:

```bash
pm2 status
pm2 logs
pm2 startup                # 开机自启
```

## 升级

### 增量更新（推荐）

```bash
# 预览变更（不实际执行）
bash deploy/scripts/update.sh openclaw-deploy-NEW.tar.gz --dry

# 执行更新
bash deploy/scripts/update.sh openclaw-deploy-NEW.tar.gz
```

增量更新会自动：

- 停止服务 → 备份数据 → 替换源码/构建产物 → 安装新依赖 → 同步 skills → 重启
- **保留**：`.env`、`data/`（配置、Agent、会话、auth profile、定时任务、Deck 数据库）
- **替换**：源码、构建产物、部署脚本、skills
- 支持回滚（当前备份目录为 `.backup/`）

Windows bare-metal 对应 PowerShell 入口：

```powershell
.\update.ps1 -Package C:\path\to\openclaw-deploy-NEW.tar.gz -DryRun
.\update.ps1 -Package C:\path\to\openclaw-deploy-NEW.tar.gz
```

### 必须全量重装的情况

- Node.js 大版本升级（如 22 → 24）
- pnpm 大版本升级
- `openclaw.json` schema 有 breaking change
- 目录结构重大调整

全量重装时手动保留 `deploy/.env` 和 `data/` 目录即可。

### Docker 模式

```bash
cd <repo>
git pull
cd deploy/docker
docker compose --env-file ../.env up -d --build
```

### 裸机模式（手动）

```bash
cd <repo>
git pull
pnpm install && pnpm build
cd dashboard && npx next build --webpack
pm2 restart all
```

## 卸载

```bash
bash deploy/scripts/teardown.sh docker      # 移除 Docker
bash deploy/scripts/teardown.sh bare-metal   # 移除 PM2 进程
bash deploy/scripts/teardown.sh all          # 移除全部（含数据）
```

## 故障排查

| 问题                | 排查方向                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| Gateway 连接失败    | 检查 `OPENCLAW_GATEWAY_TOKEN` 匹配、端口未占用                          |
| Deck 白屏/500       | 检查 `DECK_GATEWAY_URL`、migrations 目录                                |
| NOT_PAIRED 配对失败 | Docker: 确认 `network_mode: service:gateway`；裸机: 确认 localhost 连接 |
| Seed 变量未替换     | 检查 `.env` 中变量已设置                                                |
| PM2 启动失败        | `pm2 logs` 查看错误、检查 `ecosystem.config.cjs` 路径                   |

## 前置依赖安装

### Docker 模式

| 平台           | 安装命令                                       |
| -------------- | ---------------------------------------------- |
| Linux (Ubuntu) | `curl -fsSL https://get.docker.com \| sh`      |
| macOS          | `brew install --cask docker` 或 Docker Desktop |
| Windows        | Docker Desktop + WSL 2 backend                 |

### 裸机模式

| 平台    | Node.js 22+                                                          | pnpm            |
| ------- | -------------------------------------------------------------------- | --------------- |
| Linux   | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash -` | `npm i -g pnpm` |
| macOS   | `brew install node@22`                                               | `npm i -g pnpm` |
| Windows | [nodejs.org](https://nodejs.org/)                                    | `npm i -g pnpm` |
