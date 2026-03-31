# Deploy 方案全面重构设计文档

## Context

Codex 审查 `deploy/` 发现 4 个 P1 + 7 个 P2 问题，行业调研表明当前方案过度自研（~2166 行 bash/PowerShell）。
决定全面重构：Docker Compose 为主力 + PM2 替代自研脚本 + sql.js 替代 better-sqlite3 + Node.js seed 统一跨平台。

### 核心决策

| 决策         | 选择                         | 理由                                                   |
| ------------ | ---------------------------- | ------------------------------------------------------ |
| native addon | sql.js 替代 better-sqlite3   | 消除跨平台编译依赖，裸机模式只需 Node.js               |
| 进程管理     | PM2                          | 三平台统一，`pm2 startup` 自动生成 systemd/launchd     |
| 种子注入     | Node.js 脚本                 | 替代 bash + PowerShell 双实现，消除语义漂移            |
| 打包分发     | 安装包拷贝（非 registry）    | 基础镜像可在线拉取（国内镜像源），自定义镜像走文件拷贝 |
| Windows 脚本 | 删除 PowerShell，统一用 bash | Git Bash（Git for Windows 内置）运行 install.sh        |
| 打包模式     | A/B/C 叠加层                 | A=源码，B=+Docker 镜像，C=+预构建产物，可组合          |

### 目标用户

小团队分发（场景 B）：有基础技术能力的同事，会装 Docker / Node.js，不需要看源码。

---

## 1. 整体架构

### 新目录结构

```
deploy/
├── scripts/
│   ├── package.sh              # 打包入口（~150 行）
│   ├── install.sh              # 统一安装入口（~200 行）
│   ├── seed.js                 # Node.js 跨平台 seed（~80 行）
│   └── teardown.sh             # 清理卸载（~40 行）
├── docker/
│   ├── docker-compose.yml      # Docker 编排
│   ├── docker-compose.sandbox.yml  # Sandbox overlay
│   └── Dockerfile.deck         # Deck 镜像（简化版，无 native 编译）
├── ecosystem.config.cjs.tmpl   # PM2 配置模板
├── .env.example                # 环境变量模板
├── seed/                       # 种子数据
│   ├── openclaw.json.tmpl
│   ├── agents/
│   ├── cron/
│   ├── extensions/
│   ├── skills/
│   └── README.md
├── INSTALL.md                  # 用户安装指南（含平台依赖清单）
├── README.md                   # 部署总览 + 架构 + 运维手册
└── CLAUDE.md                   # AI 操作指引（打包/部署/排障/演进契约）
```

### 删除清单

| 文件/目录                                           | 删除原因                                |
| --------------------------------------------------- | --------------------------------------- |
| `bare-metal/` 整个目录                              | PM2 统一替代 install.sh/ps1/bat/service |
| `scripts/setup.sh`                                  | 合并到 `scripts/install.sh`             |
| `scripts/seed.sh`                                   | 替换为 `scripts/seed.js`                |
| `docker-compose.yml`（deploy/ 根）                  | 移到 `docker/` 子目录                   |
| `docker-compose.sandbox.yml`（deploy/ 根）          | 同上                                    |
| `Dockerfile.deck`（deploy/ 根）                     | 移到 `docker/` + 简化                   |
| `openclaw-deploy-*.tar.gz` / `.zip`（~35 个旧产物） | 清理                                    |

### 净变化

```
旧方案：~2166 行 + 43 文件
新方案：~1146 行 + 18 文件
净减少：1020 行（-47%）、25 文件（-58%）
```

---

## 2. 打包系统（package.sh）

### 打包模式（叠加层）

```bash
deploy/scripts/package.sh                        # A: 仅源码（~50MB）
deploy/scripts/package.sh --with-images          # A+B: 源码 + Docker 镜像（~800MB）
deploy/scripts/package.sh --with-prebuilt        # A+C: 源码 + 预构建（~60MB）
deploy/scripts/package.sh --full                 # A+B+C: 全量（~850MB）
deploy/scripts/package.sh --with-local           # 额外收集 ~/.openclaw/extensions + skills
deploy/scripts/package.sh --with-images --platform linux  # 指定平台镜像
```

### 打包流程

```
1. 验证 repo 状态
2. stage_source()   — git archive 导出（天然排除 .git/.env/node_modules）
3. stage_prebuilt() — [可选] 复制预构建产物：
   - Gateway: dist/（含 cli-startup-metadata.json）
   - Deck: dashboard/.next/standalone/（含 standalone/node_modules）
   - Deck: dashboard/.next/static/（CSS/JS bundles）
   - Deck: dashboard/public/（静态资源）
   - Deck: dashboard/migrations/（SQL migration 文件）
4. stage_images()   — [可选] docker build + docker save
5. stage_local()    — [可选] 收集 ~/.openclaw/extensions + skills
6. 写入 manifest.json
7. 验证包完整性（manifest 与实体一致、关键目录存在）
8. 打包为 .tar.gz
```

### manifest.json

```json
{
  "format": 1,
  "timestamp": "2026-03-31T10:00:00Z",
  "commit": "abc1234",
  "branch": "enhanced",
  "contents": {
    "source": true,
    "prebuilt": false,
    "dockerImages": true,
    "dockerPlatform": "linux/amd64",
    "localExtensions": true
  }
}
```

### source 层用 git archive

```bash
git archive HEAD --prefix=source/ | tar -C "$STAGING_DIR" -x
```

替代旧方案 rsync 的 30+ 行排除规则，消除敏感文件泄露风险。

---

## 3. 安装系统（install.sh）

### 一个脚本，三种模式，三个平台

```bash
./install.sh                # 交互式（根据 manifest 呈现可用选项）
./install.sh docker         # Docker: 加载预构建镜像启动
./install.sh docker-build   # Docker: 在线构建
./install.sh bare-metal     # 裸机: pnpm build + PM2
```

Windows 用户通过 Git Bash 运行（Git for Windows 内置）。

### 安装流程

```
1. 读取 manifest.json → 确定包内容
2. 若未指定 mode → 交互式菜单
3. 依赖检测（见 Section 8）
4. 确保 .env 存在 → 自动生成 GATEWAY_TOKEN
5. 分流：
   ├── docker       → docker load + docker compose up
   ├── docker-build → docker compose up --build
   └── bare-metal   → pnpm install → pnpm build → seed.js → pm2 start
```

### Docker 模式

```bash
docker_install() {
  if [ -d images/ ]; then
    docker load < images/gateway.tar.gz
    docker load < images/deck.tar.gz
  fi

  # Seed 注入：在 Gateway 容器内运行（不依赖宿主机 Node.js）
  # docker-compose.yml 的 gateway 容器启动后自带 Node.js
  # 通过 docker compose run 一次性执行 seed
  cd deploy/docker
  docker compose run --rm --no-deps gateway \
    node /app/deploy/scripts/seed.js /home/node/.openclaw
  docker compose up -d [--build]
}
```

> **关键决策**：Docker 模式下 seed.js 在容器内执行，宿主机不需要 Node.js。
> 裸机模式下 seed.js 在宿主机执行（Node.js 是裸机前置依赖）。

### 裸机模式

```bash
bare_metal_install() {
  check_node 22 && check_pnpm && ensure_pm2
  cd source/
  [ -f dist/cli-startup-metadata.json ] || (pnpm install && pnpm build)
  [ -f dashboard/.next/standalone/dashboard/server.js ] || (cd dashboard && pnpm install && npx next build --webpack)
  node deploy/scripts/seed.js "$STATE_DIR"
  generate_ecosystem
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
}
```

---

## 4. seed.js 统一种子注入

### 替代关系

| 旧                                                 | 新               | 行数变化 |
| -------------------------------------------------- | ---------------- | -------- |
| seed.sh (151 行) + install.ps1 seed 部分 (~100 行) | seed.js (~80 行) | -171 行  |

### 接口

```bash
node deploy/scripts/seed.js <target-dir> [--force]
# 环境变量由 .env 提供（install.sh 已加载）
```

### 种子策略

| 策略        | 行为                 | 适用内容                                   |
| ----------- | -------------------- | ------------------------------------------ |
| init-once   | 首次写入，存在则跳过 | openclaw.json, agents/, cron/, extensions/ |
| always-sync | 每次覆盖             | skills/                                    |
| never-seed  | 运行时生成           | devices/, logs/, sessions/, deck.db        |

### 消除的旧方案问题

- P1-3: Windows 无 init-once → 统一 `.seed-initialized`
- P2-7: envsubst macOS 缺失 → `String.replaceAll()`
- P2-10: Python 路径注入 → `JSON.parse()`
- bash/PowerShell 语义漂移 → 单一实现

---

## 5. PM2 进程管理

### ecosystem.config.cjs.tmpl

```js
module.exports = {
  apps: [
    {
      name: "openclaw-gateway",
      script: "openclaw.mjs",
      args: "gateway run --bind loopback --port 18789 --force",
      cwd: "__REPO_DIR__",
      env: {
        NODE_ENV: "production",
        OPENCLAW_HOME: "__OPENCLAW_HOME__",
        OPENCLAW_GATEWAY_TOKEN: "__TOKEN__",
        NO_PROXY: "localhost,127.0.0.1",
      },
      // 不使用 wait_ready（Gateway 未实现 process.send('ready')）
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: "openclaw-deck",
      script: ".next/standalone/dashboard/server.js",
      cwd: "__REPO_DIR__/dashboard",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        DECK_GATEWAY_URL: "ws://localhost:18789",
        DECK_GATEWAY_TOKEN: "__TOKEN__",
        DECK_DB_PATH: "__DECK_DATA_DIR__/deck.db",
        NO_PROXY: "localhost,127.0.0.1",
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
```

### install.sh 生成实际配置

install.sh 调用 Node.js 脚本（而非 sed）生成 `ecosystem.config.cjs`，确保值安全序列化：

```bash
node deploy/scripts/generate-ecosystem.js  # 读取 .env，输出 ecosystem.config.cjs
```

generate-ecosystem.js 使用 `JSON.stringify` 处理 provider keys，避免特殊字符破坏 JS 语法。

### PM2 startup 各平台行为

| 平台            | `pm2 startup` 生成                                          |
| --------------- | ----------------------------------------------------------- |
| Linux (systemd) | `/etc/systemd/system/pm2-<user>.service`                    |
| macOS           | `~/Library/LaunchAgents/pm2.<user>.plist`                   |
| Windows         | 可选：Task Scheduler 手动配置或 `pm2-installer`（需 PowerShell，视为高级功能） |

### 日常运维

```bash
pm2 status / pm2 logs / pm2 restart all / pm2 stop all
pm2 startup    # 注册开机自启
pm2 monit      # 实时监控
```

---

## 6. sql.js 替换 better-sqlite3

### 影响文件

| 文件                                   | 改动                                                   |
| -------------------------------------- | ------------------------------------------------------ |
| `dashboard/server/db.ts`               | **重写** — sql.js 适配层，暴露 better-sqlite3 兼容接口 |
| `dashboard/server/run-event-store.ts`  | 类型 import 改为从 db.ts                               |
| `dashboard/server/projection-store.ts` | 同上                                                   |
| `dashboard/server/access-gate.ts`      | 无变化（已是最小接口）                                 |
| `dashboard/server/device-identity.ts`  | 类型 import 改为从 db.ts                               |
| `dashboard/package.json`               | `better-sqlite3` → `sql.js`                            |
| `dashboard/next.config.ts`             | 移除 `serverExternalPackages: ['better-sqlite3']`      |
| `deploy/docker/Dockerfile.deck`        | 删除 native addon 编译阶段                             |

### 异步初始化方案

**问题**：sql.js 的 `initSqlJs()` 是异步的，但现有 `getDb()` 被同步调用。

**方案**：Next.js instrumentation hook（`dashboard/instrumentation.ts`）在服务启动时预加载 sql.js WASM：

```ts
// dashboard/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { preloadSqlJs } = await import('./server/db');
    await preloadSqlJs();  // 加载 WASM，缓存到模块级变量
  }
}
```

`db.ts` 内部维护一个模块级缓存的 SQL 引擎实例，`openDb()` / `getDb()` 保持同步接口：

```ts
let _sqlEngine: SqlJsStatic | null = null;

export async function preloadSqlJs() {
  _sqlEngine = await initSqlJs();
}

export function openDb(dbPath?: string): DatabaseAdapter {
  if (!_sqlEngine) throw new Error('sql.js not preloaded — call preloadSqlJs() first');
  // 同步读取文件 → 打开内存 DB
  const buffer = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath) : undefined;
  const db = new _sqlEngine.Database(buffer);
  return new DatabaseAdapter(db, resolvedPath);
}
```

### 适配层设计

db.ts 内部创建 `DatabaseAdapter` 类，暴露完整的 better-sqlite3 兼容接口：

| better-sqlite3 API | sql.js 适配方式 |
|---------------------|----------------|
| `new Database(path)` | `new _sqlEngine.Database(buffer)` + 文件读取 |
| `db.prepare(sql)` | `StatementAdapter` 包装 |
| `stmt.all(...params)` → 对象数组 | 列名 + 值数组 → 转换为对象数组 |
| `stmt.get(...params)` → 单对象 | `.all()` 取第一行 |
| `stmt.run(...params)` → `{changes, lastInsertRowid}` | 执行后查询 `changes()` + `last_insert_rowid()` |
| `db.exec(sql)` | `db.run(sql)` + save |
| `db.pragma(str)` | `db.run('PRAGMA ' + str)` |
| `db.transaction(fn)` | BEGIN/COMMIT/ROLLBACK 包装 + save |
| `db.close()` | save + `db.close()` |
| WAL 模式 | 跳过（单进程无需 WAL） |

### 持久化策略

**原子写**：避免进程崩溃时数据损坏：

```ts
private save() {
  if (this.dbPath === ':memory:') return;
  const data = this.db.export();
  const tmp = this.dbPath + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, this.dbPath);  // 原子替换
}
```

**写入频率**：仅在写操作（`run`/`exec`/`transaction` 结束）后 save，读操作不触发。
Dashboard 写入频率极低（配置变更、session 记录），性能影响可忽略。

**崩溃恢复**：最坏情况丢失最后一次未完成的写操作（transaction 内的多次 write）。
对 dashboard 场景可接受——不是金融交易系统。

### 数据兼容

sql.js 读写标准 SQLite 格式，与 better-sqlite3 的 .db 文件完全兼容。无需数据迁移。

---

## 7. Docker 编排

### 变化

- `docker-compose.yml` 和 `Dockerfile.deck` 移到 `deploy/docker/` 子目录
- `Dockerfile.deck` 删除 native addon 编译（sed/prebuild-install/COPY build）
- 其余编排逻辑不变（Gateway 构建用根 Dockerfile，Deck 共享 Gateway 网络）

### docker-compose.package.yml

打包时生成，使用 `image:` 而非 `build:`。install.sh 根据 manifest 选择 compose 文件。

---

## 8. 依赖检测 + 安装文档

### install.sh 依赖检测

安装脚本在执行前做完整依赖检测，失败时输出平台对应的安装指引。

检测项：

- Docker 模式：docker + docker compose v2（**不需要 Node.js**，seed 在容器内执行）
- 裸机模式：Node.js 22+ + pnpm + PM2（自动安装）
- 通用：端口占用（18789/3000）、磁盘空间（Docker 需 2GB+，裸机需 1GB+）

### INSTALL.md

安装包根目录的用户文档，包含：

- 各平台前置依赖和安装命令
- 快速开始（Docker / 裸机）
- 安装后管理命令
- 故障排查表

### README.md

deploy/ 目录的完整运维手册，包含：

- 架构图（Gateway:18789 → Deck:3000 → Browser）
- 部署模式对比（Docker / Docker Build / 裸机）
- 打包命令和参数
- 环境变量说明
- 数据目录结构
- 种子定制
- 升级流程
- 分离部署说明

### CLAUDE.md

AI 操作指引，确保 Claude Code 在未来迭代中能正确操作部署系统。包含：

**关键文件索引**：每个脚本的用途和参数。

**部署命令序列**：Docker / 裸机各步骤的完整命令。

**架构约束**：

- Gateway 必须从源码运行（增强 fork）
- Docker 模式下 Deck 共享 Gateway 网络（自动配对）
- seed 策略（init-once / always-sync）
- PM2 ecosystem 模板占位符

**演进契约（关键）**：

- 新增 Gateway RPC 方法 → 无需改部署脚本
- 新增环境变量 → 更新 .env.example + seed.js TEMPLATE_VARS + ecosystem.config.cjs.tmpl
- 新增 seed 内容 → 更新 seed/ 目录 + seed.js 的处理逻辑
- 修改 Deck 依赖 → 检查 Dockerfile.deck 是否需要调整
- 修改 Gateway 启动参数 → 更新 ecosystem.config.cjs.tmpl + docker-compose.yml command
- 升级 Node.js 基线版本 → 更新 Dockerfile 基础镜像 + install.sh 版本检测 + INSTALL.md
- 新增打包层（如 Helm chart）→ 扩展 package.sh 参数，不改现有层

**变更检测提示**：

```
当修改以下文件时，检查是否需要同步更新 deploy/ 下的对应文件：
- package.json (bin/scripts/dependencies) → ecosystem.config.cjs.tmpl, Dockerfile
- dashboard/package.json (dependencies) → Dockerfile.deck, seed.js
- src/gateway/ (启动参数变更) → ecosystem.config.cjs.tmpl, docker-compose.yml
- .env 新增变量 → .env.example, seed.js TEMPLATE_VARS, INSTALL.md
- openclaw.json schema 变更 → seed/openclaw.json.tmpl
```

---

## 9. 前置依赖总结

### Docker 模式

| 平台    | 需要安装                   |
| ------- | -------------------------- |
| Linux   | Docker Engine + Compose v2 |
| macOS   | Docker Desktop             |
| Windows | Docker Desktop             |

### 裸机模式

| 平台    | 需要安装                                                  |
| ------- | --------------------------------------------------------- |
| Linux   | Node.js 22+, pnpm (corepack), PM2 (自动), Git             |
| macOS   | Node.js 22+, pnpm (corepack), PM2 (自动)                  |
| Windows | Node.js 22+, pnpm (corepack), PM2 (自动), Git for Windows |

不再需要：python3, make, gcc, Visual Studio Build Tools, Xcode CLT, envsubst。

---

## 10. 验证计划

1. **sql.js 适配层**：运行 Deck 现有测试，确认数据库操作兼容
2. **seed.js**：对比旧 seed.sh 输出，确认种子注入结果一致
3. **Docker 模式**：`docker compose up --build`，验证 Gateway 健康 + Deck 可访问
4. **裸机模式（macOS）**：`install.sh bare-metal`，验证 PM2 启动 + 开机自启
5. **打包 A/B/C**：分别打包，检查 manifest 和包内容正确
6. **安装包安装**：从 tar.gz 解压，运行 install.sh，验证交互式菜单和依赖检测
7. **跨平台**：至少在 macOS + Linux (Docker) 上完整验证
