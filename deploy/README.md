# OpenClaw Deploy

OpenClaw Gateway + Deck Dashboard 的统一部署方案。

## 架构

```
Browser ──→ Deck(:3000) ──ws──→ Gateway(:18789) ──→ AI Providers
                ↓                       ↓
          deck.db (SQLite)      .openclaw/ (config/agents/sessions)
```

- **Gateway** — OpenClaw 核心引擎，处理 AI 调用、工具执行、会话管理
- **Deck** — Next.js Web 仪表板，通过 WebSocket 连接 Gateway
- Docker 模式下 Deck 与 Gateway 共享网络命名空间，通过 localhost 自动完成设备配对

## 部署模式

| 模式         | 适用场景                     | 依赖                |
| ------------ | ---------------------------- | ------------------- |
| Docker       | 推荐。隔离环境，一键部署     | Docker + Compose v2 |
| Docker Build | 同上，强制重建镜像           | Docker + Compose v2 |
| 裸机 (PM2)   | 开发环境、无 Docker 的服务器 | Node.js 22+, pnpm   |

## 快速开始

### 1. 配置环境变量

```bash
cd deploy
cp .env.example .env
vim .env  # 至少设置一个 AI Provider API Key
```

### 2. 安装部署

```bash
# 交互式菜单
bash scripts/install.sh

# 或直接指定模式
bash scripts/install.sh docker       # Docker 模式
bash scripts/install.sh bare-metal   # 裸机模式
```

### 3. 验证

```bash
curl -s http://localhost:18789/healthz  # Gateway
curl -s http://localhost:3000           # Deck
```

## 打包（跨机器部署）

```bash
# A-layer: 仅源码 (~50MB)
deploy/scripts/package.sh

# A+C: 源码 + 预构建产物 (~60MB)
deploy/scripts/package.sh --with-prebuilt

# A+B: 源码 + Docker 镜像 (~800MB)
deploy/scripts/package.sh --with-images --platform linux

# A+B+C: 全部
deploy/scripts/package.sh --full --platform linux

# 收集本地插件和 skills
deploy/scripts/package.sh --with-local

# 包含 Windows 离线安装包（Node.js MSI + Docker Desktop）
deploy/scripts/prepare-deps.sh   # 先下载依赖
deploy/scripts/package.sh --with-deps
```

### 打包层说明

| 层           | 内容                           | 大小   | 用途                                 |
| ------------ | ------------------------------ | ------ | ------------------------------------ |
| A (source)   | 源码 + 部署脚本 + seed         | ~50MB  | 始终包含                             |
| B (images)   | Docker 镜像 (.tar.gz)          | ~800MB | 离线 Docker 部署（建议在目标机构建） |
| C (prebuilt) | Gateway dist + Deck standalone | ~10MB  | 跳过裸机构建                         |
| deps         | Windows 离线安装包             | ~675MB | Git for Windows + Node.js MSI + Docker Desktop |

### Windows 离线部署

提前下载 Windows 依赖，避免目标机下载缓慢：

```bash
# 下载全部（Node.js + Docker Desktop）
deploy/scripts/prepare-deps.sh

# 仅 Node.js（~60MB）
deploy/scripts/prepare-deps.sh --node-only

# 打包时带上
deploy/scripts/package.sh --with-prebuilt --with-deps
```

安装包内 `deps/` 目录包含 MSI/EXE 安装程序，目标机按 `deps/README.md` 手动安装后再运行 `install.sh`。

### 部署安装包

```bash
scp openclaw-deploy-*.tar.gz user@target:/tmp/
ssh user@target
tar xzf /tmp/openclaw-deploy-*.tar.gz
cd openclaw-deploy-*
vim source/deploy/.env   # 配置 API Keys
./install.sh             # 交互式安装
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
    deck.db               # SQLite 数据库
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

## 管理命令

### Docker 模式

```bash
cd deploy/docker
docker compose --env-file ../.env ps          # 状态
docker compose --env-file ../.env logs -f     # 日志
docker compose --env-file ../.env restart     # 重启
docker compose --env-file ../.env down        # 停止
docker compose --env-file ../.env up -d --build  # 重建
```

### 裸机模式 (PM2)

```bash
pm2 status                 # 状态
pm2 logs                   # 日志
pm2 restart all            # 重启
pm2 stop all               # 停止
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
- 支持回滚（备份在 `.backup-YYYYMMDD-HHMMSS/`）

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
