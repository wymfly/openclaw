# Deploy — Claude Code 操作指引

本文件指导 Claude Code 如何操作 OpenClaw + Deck 的部署系统，并在项目迭代时保持部署脚本同步。

## 部署架构

- Gateway（:18789）: OpenClaw 核心，源码构建运行
- Deck（:3000）: Next.js standalone dashboard，sql.js (WASM SQLite) 无 native addon
- 连接: Deck → Gateway via WebSocket（`DECK_GATEWAY_URL`）
- 认证: `OPENCLAW_GATEWAY_TOKEN` + Ed25519 device identity
- Docker 模式: Deck 与 Gateway 共享网络（`network_mode: service:gateway`），通过 localhost 自动配对
- 裸机模式: PM2 进程管理，`ecosystem.config.cjs` 配置

## 关键文件索引

| 文件 | 用途 | 何时修改 |
|------|------|---------|
| `scripts/install.sh` | 统一安装入口（Docker/裸机） | 新增安装模式或依赖时 |
| `scripts/package.sh` | 打包入口（A/B/C 叠加层） | 新增打包层时 |
| `scripts/seed.js` | 种子注入（Node.js 跨平台） | 新增 seed 内容或模板变量时 |
| `scripts/generate-ecosystem.js` | PM2 配置生成 | 修改启动参数或 env 时 |
| `scripts/teardown.sh` | 卸载清理 | 修改安装路径时 |
| `scripts/prepare-deps.sh` | Windows 离线依赖下载 | Node.js 版本升级时 |
| `docker/docker-compose.yml` | Docker 编排 | 修改容器配置时 |
| `docker/docker-compose.package.yml` | 预构建镜像 overlay | 修改镜像 tag 时 |
| `docker/docker-compose.sandbox.yml` | Sandbox overlay | 修改沙箱配置时 |
| `docker/Dockerfile.deck` | Deck 镜像（无 native addon） | 修改 Deck 依赖时 |
| `ecosystem.config.cjs.tmpl` | PM2 模板 | 修改启动参数时 |
| `.env.example` | 环境变量模板 | 新增 env var 时 |
| `seed/openclaw.json.tmpl` | 配置模板 | 修改默认配置时 |

## 演进契约

**当修改以下文件时，检查是否需要同步更新 deploy/ 下的对应文件：**

| 触发变更 | 需检查的 deploy 文件 |
|---------|---------------------|
| `package.json` (bin/scripts/deps) | `ecosystem.config.cjs.tmpl`, `docker/Dockerfile.deck` |
| `dashboard/package.json` (deps) | `docker/Dockerfile.deck` |
| `src/gateway/` (启动参数) | `ecosystem.config.cjs.tmpl`, `docker/docker-compose.yml` command |
| `.env` 新增变量 | `.env.example`, `scripts/seed.js` TEMPLATE_VARS, `scripts/generate-ecosystem.js` providerKeys |
| `openclaw.json` schema | `seed/openclaw.json.tmpl` |
| `dashboard/server/db.ts` (sql.js) | `docker/Dockerfile.deck`（确认无 native addon 残留） |
| `dashboard/migrations/` | `docker/Dockerfile.deck` COPY 步骤 |
| Node.js 版本升级 | `docker/Dockerfile.deck` FROM, `scripts/install.sh` check_node, `scripts/prepare-deps.sh` NODE_VERSION |
| pnpm 版本升级 | `docker/Dockerfile.deck` corepack prepare |

## 部署命令序列

### Docker 模式

```bash
cd deploy
cp .env.example .env && vim .env
bash scripts/install.sh docker
# 验证
curl -sf http://localhost:18789/healthz
curl -sf http://localhost:3000
```

### 裸机模式 (PM2)

```bash
cd deploy
cp .env.example .env && vim .env
bash scripts/install.sh bare-metal
# 验证
pm2 status
curl -sf http://localhost:18789/healthz
curl -sf http://localhost:3000
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
- Deck 使用 sql.js (WASM SQLite)，**无 native addon**，Dockerfile 中不需要 node-gyp/prebuild-install
- Docker 模式 Gateway 使用 `--bind lan`（容器对外），裸机使用 `--bind loopback`（安全）
- Seed 策略：`init-once`（config/agents/cron/extensions）、`always-sync`（skills）
- PM2 配置由 `generate-ecosystem.js` 从模板生成，不要手编 `ecosystem.config.cjs`
- `deploy/.env` 包含敏感信息，`.gitignore` 已排除

## 常见错误诊断

| 问题 | 检查 |
|------|------|
| Gateway 连接失败 | `OPENCLAW_GATEWAY_TOKEN` 匹配、端口未占用 |
| Deck 白屏 | `DECK_GATEWAY_URL` 正确、migrations 目录存在 |
| NOT_PAIRED | Docker: `network_mode: service:gateway`；裸机: localhost |
| PM2 启动失败 | `pm2 logs`、检查 `ecosystem.config.cjs` 路径 |
| Docker 构建失败 | 检查 `docker/Dockerfile.deck` 是否引用了已移除的 better-sqlite3 |
