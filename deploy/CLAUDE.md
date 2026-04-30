# Deploy — Claude Code 操作指引

> **⚠️ Legacy 状态 / Archived (2026-04-28)**
>
> `deploy/` 是上一代 OpenClaw + Deck（Next.js dashboard）的部署系统，已**冻结**，仅作为历史参考。涉及的产物：`openclaw-deploy-*.tar.gz`、`install.sh/ps1/bat`、PM2/Scheduled Task 路径等，均针对 `dashboard/`。
>
> 当前二次开发主目标 `deck-go/` 的部署形态待规划，**不复用本目录**。新工作请见仓库根 `AGENTS.md` 的「二次开发主目标」与「Deck-go 开发环境（新主目标）」章节。
>
> 本文件保留供 `dashboard/` 部署期排查问题；下面的部署架构与脚本规则仅适用于上一代部署链路。

本文件指导 Claude Code 如何操作 OpenClaw + Deck 的部署系统，并在项目迭代时保持部署脚本同步。

## 部署架构

- Gateway（:18789）: OpenClaw 核心，源码构建运行
- Deck（:3000）: Next.js standalone dashboard，JSON 文件持久化，无 native addon
- 连接: Deck → Gateway via WebSocket（`DECK_GATEWAY_URL`）
- 认证: `OPENCLAW_GATEWAY_TOKEN` + Ed25519 device identity
- Docker 模式: Deck 与 Gateway 共享网络（`network_mode: service:gateway`），通过 localhost 自动配对
- 裸机模式:
  - Windows PowerShell 路径: Scheduled Task / Startup fallback + 单一 supervisor
  - 现有 shell 路径: PM2 进程管理，`ecosystem.config.cjs` 配置

## 关键文件索引

| 文件 | 用途 | 何时修改 |
|------|------|---------|
| `STATUS.md` | 当前部署状态与下一次部署上下文 | 每次部署/发布/验证完成后 |
| `install.ps1` | Windows 原生安装入口（bare-metal） | 修改 Windows 主安装路径时 |
| `install.sh` | 根目录安装入口（forwarder） | 一般不改 |
| `update.ps1` | Windows 原生更新入口（bare-metal） | 修改 Windows 更新流程时 |
| `start.ps1` / `stop.ps1` / `status.ps1` | Windows 原生运维入口 | 修改 Windows 运维流程时 |
| `start.sh` / `start.bat` | 根目录启动脚本 | 修改启动逻辑时 |
| `stop.sh` / `stop.bat` | 根目录停止脚本 | 修改停止逻辑时 |
| `status.sh` / `status.bat` | 根目录状态脚本 | 修改状态检查时 |
| `scripts/windows/common.ps1` | Windows PowerShell 共享辅助函数 | 修改 Windows 依赖、自举、env/路径逻辑时 |
| `scripts/windows/install-or-upgrade.ps1` | Windows bare-metal install/update/rollback 核心逻辑 | 修改 Windows 安装/升级机制时 |
| `scripts/windows/service.ps1` | Windows 服务安装/启动/停止/状态（Scheduled Task / Startup fallback） | 修改 Windows 运行时治理时 |
| `scripts/windows/supervisor.mjs` | Windows 单一 supervisor（拉起 Gateway + Deck） | 修改 Windows 进程模型时 |
| `scripts/windows/package-self-contained.ps1` | 给已有 deploy tar.gz 增补 Windows `source/node_modules` | 产出 Windows 自包含发布物时 |
| `scripts/install.sh` | 实际安装逻辑（自动装依赖 + 构建 + 启动） | 新增安装模式或依赖时 |
| `scripts/package.sh` | 打包入口（A/B/C 叠加层） | 新增打包层时 |
| `bootstrap-install.ps1` | 可托管 Windows bootstrap 安装器模板 | 修改一条命令分发逻辑时 |
| `serve-release-http.cmd` | Windows 发布 HTTP 启动入口 | 修改安装包独立发布端口时 |
| `scripts/windows/serve-release-http.mjs` | Windows 安装包静态文件服务 | 修改 `publish/` 暴露逻辑时 |
| `scripts/seed.js` | 种子注入（Node.js 跨平台） | 新增 seed 内容或模板变量时 |
| `scripts/generate-ecosystem.js` | PM2 配置生成 | 修改启动参数或 env 时 |
| `scripts/teardown.sh` | 卸载清理 | 修改安装路径时 |
| `scripts/update.sh` | 增量更新（保留用户数据） | 更新流程变化时 |
| `scripts/prepare-deps.sh` | Windows 离线依赖下载（Node.js + Docker + 可选 Git fallback） | 版本升级时 |
| `docker/docker-compose.yml` | Docker 编排 | 修改容器配置时 |
| `docker/docker-compose.package.yml` | 预构建镜像 overlay | 修改镜像 tag 时 |
| `docker/docker-compose.sandbox.yml` | Sandbox overlay | 修改沙箱配置时 |
| `docker/Dockerfile.deck` | Deck 镜像（无 native addon） | 修改 Deck 依赖时 |
| `ecosystem.config.cjs.tmpl` | PM2 模板 | 修改启动参数时 |
| `.env.example` | 环境变量模板（含预填凭据） | 新增 env var 或更新凭据时 |
| `seed/openclaw.json.tmpl` | 配置模板 | 修改默认配置时 |
| `seed/agents/main/agent/auth-profiles.json.tmpl` | Auth profile 模板 | 新增/修改 provider 时 |
| `docs/INSTALL-*.md` | 分平台安装指南 | 安装流程变化时 |

## 演进契约

**每次真实部署、升级、发布、验证、回滚之后，都要更新 `deploy/STATUS.md`。**

至少记录：

- 当前 live app root / task / 端口
- 最近一次备份路径
- 当前 publish 目录和 install 命令
- 外部验证结果
- 是否还有“live 已升级但发布包未更新”之类的遗留项

**当修改以下文件时，检查是否需要同步更新 deploy/ 下的对应文件：**

| 触发变更 | 需检查的 deploy 文件 |
|---------|---------------------|
| `package.json` (bin/scripts/deps) | `ecosystem.config.cjs.tmpl`, `docker/Dockerfile.deck` |
| `dashboard/package.json` (deps) | `docker/Dockerfile.deck` |
| `src/gateway/` (启动参数) | `ecosystem.config.cjs.tmpl`, `docker/docker-compose.yml` command |
| `.env` 新增变量 | `.env.example`, `scripts/seed.js` TEMPLATE_VARS, `scripts/generate-ecosystem.js` providerKeys |
| `openclaw.json` schema | `seed/openclaw.json.tmpl` |
| `dashboard/server/json-store.ts` | `docker/Dockerfile.deck`（确认 DECK_DATA_DIR 一致） |
| `dashboard/standalone-entry.mjs` | `docker/Dockerfile.deck` COPY + CMD |
| `extensions/wecom/` (deps/config) | `seed/openclaw.json.tmpl` plugins entries |
| Node.js 版本升级 | `docker/Dockerfile.deck` FROM, `scripts/install.sh` check_node, `scripts/prepare-deps.sh` NODE_VERSION |
| pnpm 版本升级 | `docker/Dockerfile.deck` corepack prepare |

## 部署命令序列

### 一键安装（推荐）

```bash
cd deploy
bash install.sh bare-metal   # 自动创建 .env + 装依赖 + 构建 + 启动
bash status.sh               # 验证
```

`.env.example` 已预填 CPA 凭据和 Gateway Token，`install.sh` 自动从 example 创建 `.env`。

### Windows bare-metal（PowerShell）

```powershell
cd deploy
powershell -ExecutionPolicy Bypass -File .\install.ps1
.\status.ps1
```

当前 Windows PowerShell 路径只覆盖 **Windows bare-metal**。Docker-on-Windows 仍走现有 shell 路径。

### Docker 模式

```bash
cd deploy
bash install.sh docker
bash status.sh
```

### 运维

```bash
cd deploy
bash start.sh     # 启动（Windows: 双击 start.bat）
bash stop.sh      # 停止（Windows: 双击 stop.bat）
bash status.sh    # 状态（Windows: 双击 status.bat）
```

Windows PowerShell 等价命令：

```powershell
cd deploy
.\start.ps1
.\stop.ps1
.\status.ps1
```

### 打包

```bash
deploy/scripts/package.sh                     # A: 仅源码
deploy/scripts/package.sh --with-prebuilt     # A+C: 含预构建
deploy/scripts/package.sh --windows-self-contained  # A+C + source/node_modules，自包含 Windows 包
deploy/scripts/package.sh --with-images       # A+B: 含 Docker 镜像（建议在目标机构建）
deploy/scripts/package.sh --full              # A+B+C: 全部
deploy/scripts/prepare-deps.sh               # 下载 Windows 离线依赖
deploy/scripts/package.sh --with-deps         # 打包时包含离线依赖
deploy/scripts/package.sh --with-local        # 收集本地插件/skills
deploy/scripts/package.sh --bootstrap-base-url https://<your-host>/windows  # 额外产出可托管 bootstrap 资产
powershell -ExecutionPolicy Bypass -File .\deploy\package-self-contained.ps1 -BasePackage .\openclaw-deploy-*.tar.gz -NodeModulesPath .\node_modules
```

## 架构约束

- Gateway 必须从增强 fork 源码运行（包含自定义 RPC handlers），不得使用全局 `openclaw` 命令
- 不走官方 `openclaw setup` 向导，完全通过 seed 模板 + `.env` 替代
- Deck 使用 JSON 文件持久化（JsonStore），**无 native addon**，Dockerfile 中不需要 node-gyp/prebuild-install
- Docker 模式 Gateway 使用 `--bind lan`（容器对外），裸机使用 `--bind loopback`（安全）
- Seed 策略：`init-once`（config/agents/cron/extensions）、`always-sync`（skills）
- Agent 目录中的 `.tmpl` 文件（如 `auth-profiles.json.tmpl`）会被渲染后写入，已有文件不覆盖
- PM2 配置由 `generate-ecosystem.js` 从模板生成，不要手编 `ecosystem.config.cjs`
- `.env.example` 已预填 CPA 凭据和固定 Gateway Token（内部使用），`install.sh` 自动从中创建 `.env`
- `deploy/.env` 包含敏感信息，`.gitignore` 已排除

## Standalone 模式注意事项

Deck 使用 Next.js standalone 输出部署，有几个已知问题需要 workaround：

| 问题 | Workaround |
|------|-----------|
| Deck 绑定到 APIPA 地址而非 0.0.0.0 | PM2 env 设置 `HOSTNAME=0.0.0.0` |
| 自定义 provider 显示"未配置" | `auth-profiles.json.tmpl` seed 模板注册 auth profile |

## 增量更新

```bash
# 预览变更
bash deploy/scripts/update.sh new-package.tar.gz --dry

# 执行更新
bash deploy/scripts/update.sh new-package.tar.gz
```

Windows bare-metal PowerShell：

```powershell
.\update.ps1 -Package C:\path\to\openclaw-deploy-NEW.tar.gz -DryRun
.\update.ps1 -Package C:\path\to\openclaw-deploy-NEW.tar.gz
```

## Windows 发布端口

Windows 用户安装资产必须走**独立 HTTP 端口**，不要复用 Deck 的 `3340` 或默认 `80/443`。

推荐：

```powershell
cd deploy
.\serve-release-http.cmd
```

默认：

```text
根目录: deploy/publish
端口: 8088
```

**数据保留策略**：

| 数据 | 更新时 | 说明 |
|------|--------|------|
| `deploy/.env` | 保留 | API keys、token |
| `data/.openclaw/openclaw.json` | 保留 | 用户可能已自定义 |
| `data/.openclaw/agents/` | 保留 | 会话、auth profile |
| `data/.openclaw/cron/` | 保留 | 定时任务 |
| `data/.openclaw/extensions/` | 保留 | 用户安装的插件 |
| `data/openclaw-deck/*.json` | 保留 | Deck 配置和状态数据 |
| `data/.openclaw/skills/` | 覆盖 | always-sync |
| `source/dist/`、`dashboard/.next/` | 替换 | 构建产物 |
| `deploy/scripts/` | 替换 | 部署脚本 |

**必须全量重装**：Node.js 大版本升级、pnpm 大版本升级、`openclaw.json` schema breaking change。

## 常见错误诊断

| 问题 | 检查 |
|------|------|
| Gateway 连接失败 | `OPENCLAW_GATEWAY_TOKEN` 匹配、端口未占用 |
| Deck 白屏 | `DECK_GATEWAY_URL` 正确、migrations 目录存在 |
| NOT_PAIRED | Docker: `network_mode: service:gateway`；裸机: localhost |
| PM2 启动失败 | `pm2 logs`、检查 `ecosystem.config.cjs` 路径 |
| Docker 构建失败 | 检查 `docker/Dockerfile.deck` 依赖和 COPY 步骤 |
| 供应商显示未配置 | 确认 `auth-profiles.json` 存在于 `data/.openclaw/agents/main/agent/` |
| Windows 端口被占用 | `netstat -ano \| findstr :18789`，`taskkill /PID <pid> /F` |
