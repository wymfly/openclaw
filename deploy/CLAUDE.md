# Deploy — Claude Code 操作指引

本文件指导 Claude Code 如何操作 OpenClaw + Deck 的部署系统，并在项目迭代时保持部署脚本同步。

## 部署架构

- Gateway（:18789）: OpenClaw 核心，源码构建运行
- Deck（:3000）: Next.js standalone dashboard，JSON 文件持久化，无 native addon
- 连接: Deck → Gateway via WebSocket（`DECK_GATEWAY_URL`）
- 认证: `OPENCLAW_GATEWAY_TOKEN` + Ed25519 device identity
- Docker 模式: Deck 与 Gateway 共享网络（`network_mode: service:gateway`），通过 localhost 自动配对
- 裸机模式: PM2 进程管理，`ecosystem.config.cjs` 配置

## 关键文件索引

| 文件 | 用途 | 何时修改 |
|------|------|---------|
| `install.sh` | 根目录安装入口（forwarder） | 一般不改 |
| `start.sh` / `start.bat` | 根目录启动脚本 | 修改启动逻辑时 |
| `stop.sh` / `stop.bat` | 根目录停止脚本 | 修改停止逻辑时 |
| `status.sh` / `status.bat` | 根目录状态脚本 | 修改状态检查时 |
| `scripts/install.sh` | 实际安装逻辑（自动装依赖 + 构建 + 启动） | 新增安装模式或依赖时 |
| `scripts/package.sh` | 打包入口（A/B/C 叠加层） | 新增打包层时 |
| `scripts/seed.js` | 种子注入（Node.js 跨平台） | 新增 seed 内容或模板变量时 |
| `scripts/generate-ecosystem.js` | PM2 配置生成 | 修改启动参数或 env 时 |
| `scripts/teardown.sh` | 卸载清理 | 修改安装路径时 |
| `scripts/update.sh` | 增量更新（保留用户数据） | 更新流程变化时 |
| `scripts/prepare-deps.sh` | Windows 离线依赖下载（Git + Node.js + Docker） | 版本升级时 |
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

### 打包

```bash
deploy/scripts/package.sh                     # A: 仅源码
deploy/scripts/package.sh --with-prebuilt     # A+C: 含预构建
deploy/scripts/package.sh --with-images       # A+B: 含 Docker 镜像（建议在目标机构建）
deploy/scripts/package.sh --full              # A+B+C: 全部
deploy/scripts/prepare-deps.sh               # 下载 Windows 离线依赖
deploy/scripts/package.sh --with-deps         # 打包时包含离线依赖
deploy/scripts/package.sh --with-local        # 收集本地插件/skills
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
