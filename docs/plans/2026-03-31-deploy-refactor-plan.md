# Deploy 全面重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Docker Compose + PM2 + sql.js + 统一 Node.js seed 替代 ~2166 行自研部署脚本，实现三平台可靠部署。

**Architecture:** sql.js 替代 better-sqlite3 消除 native addon；PM2 统一进程管理；seed.js 统一种子注入；install.sh 一个脚本三模式；package.sh 支持 A/B/C 叠加层打包。

**Tech Stack:** Node.js 22+, PM2, sql.js (WASM SQLite), Docker Compose, Next.js standalone

**Design Doc:** `docs/plans/2026-03-31-deploy-refactor-design.md`

---

## Task 0: 清理旧打包产物

**Files:**
- Delete: `deploy/openclaw-deploy-*.tar.gz` (~15 files, ~3GB)
- Delete: `deploy/openclaw-deploy-*.zip` (~20 files, ~5GB)

- [ ] **Step 1: 删除旧打包产物**

```bash
rm -f deploy/openclaw-deploy-*.tar.gz deploy/openclaw-deploy-*.zip
```

- [ ] **Step 2: 添加 gitignore 规则**

在 `deploy/.gitignore`（如不存在则创建）中添加：

```
# Package artifacts
openclaw-deploy-*.tar.gz
openclaw-deploy-*.zip
*.tar
data/
.env
ecosystem.config.cjs
.DS_Store
```

- [ ] **Step 3: Commit**

```bash
scripts/committer "chore(deploy): clean up old package artifacts + add .gitignore" deploy/.gitignore
```

---

## Task 1: sql.js 依赖替换 + 适配层核心

**Files:**
- Modify: `dashboard/package.json` — 替换依赖
- Rewrite: `dashboard/server/db.ts` — sql.js 适配层
- Create: `dashboard/instrumentation.ts` — WASM 预加载
- Modify: `dashboard/next.config.ts` — 移除 serverExternalPackages

- [ ] **Step 1: 替换依赖**

```bash
cd dashboard
pnpm remove better-sqlite3 @types/better-sqlite3
pnpm add sql.js
```

- [ ] **Step 2: 创建 instrumentation.ts**

创建 `dashboard/instrumentation.ts`：

```ts
/**
 * Next.js instrumentation hook — preloads sql.js WASM engine at server startup.
 * This ensures getDb()/openDb() can operate synchronously.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { preloadSqlJs } = await import("./server/db");
    await preloadSqlJs();
  }
}
```

- [ ] **Step 3: 重写 db.ts 适配层**

重写 `dashboard/server/db.ts`。适配层需要覆盖的 API surface（来自代码分析）：

- `db.prepare(sql)` → `StatementAdapter`
- `stmt.run(...params)` → 返回 `{ changes, lastInsertRowid }`
- `stmt.get(...params)` → 返回单行对象或 undefined
- `stmt.all(...params)` → 返回对象数组
- `db.exec(sql)` → 执行裸 SQL
- `db.pragma(str)` → PRAGMA 命令
- `db.transaction(fn)` → BEGIN/COMMIT/ROLLBACK 包装
- `db.close()` → save + close
- 原子持久化：tmp + rename

关键实现要点：

```ts
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";
import fs from "node:fs";
import path from "node:path";

// --- Module-level WASM engine cache ---
let _engine: SqlJsStatic | null = null;

export async function preloadSqlJs(): Promise<void> {
  if (!_engine) {
    _engine = await initSqlJs();
  }
}

// --- Statement Adapter ---
class StatementAdapter {
  constructor(private db: SqlJsDatabase, private sql: string, private saveFn: () => void) {}

  run(...params: unknown[]) {
    this.db.run(this.sql, params as any[]);
    this.saveFn();
    const changes = this.db.getRowsModified();
    const [{ lastId }] = this.db.exec("SELECT last_insert_rowid() as lastId");
    return { changes, lastInsertRowid: lastId?.values?.[0]?.[0] ?? 0 };
  }

  get(...params: unknown[]) {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as any[]);
    if (!stmt.step()) { stmt.free(); return undefined; }
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    stmt.free();
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    return row;
  }

  all(...params: unknown[]) {
    const results = this.db.exec(this.sql, params as any[]);
    if (!results.length) return [];
    const { columns, values } = results[0];
    return values.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }
}

// --- Database Adapter ---
class DatabaseAdapter {
  constructor(private db: SqlJsDatabase, private dbPath: string) {}

  prepare(sql: string) { return new StatementAdapter(this.db, sql, () => this.save()); }
  exec(sql: string) { this.db.run(sql); this.save(); }

  pragma(str: string) {
    // "journal_mode = WAL" → skip (WASM 不支持)
    if (str.toLowerCase().includes("journal_mode")) return;
    this.db.run(`PRAGMA ${str}`);
  }

  transaction<T>(fn: (...args: any[]) => T) {
    return (...args: any[]) => {
      this.db.run("BEGIN");
      try {
        const result = fn(...args);
        this.db.run("COMMIT");
        this.save();
        return result;
      } catch (e) {
        this.db.run("ROLLBACK");
        throw e;
      }
    };
  }

  close() { this.save(); this.db.close(); }

  private save() {
    if (this.dbPath === ":memory:") return;
    const data = this.db.export();
    const tmp = this.dbPath + ".tmp";
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, this.dbPath);
  }
}

export type Database = DatabaseAdapter;
```

保留 `openDb()`、`getDb()`、`runMigrations()` 的外部接口不变，内部用 `DatabaseAdapter` 替代。

- [ ] **Step 4: 更新 next.config.ts**

从 `serverExternalPackages` 中移除 `"better-sqlite3"`（保留 `"ws"` 如有）。

- [ ] **Step 5: 验证编译**

```bash
cd dashboard && pnpm tsc --noEmit
```

预期：类型错误需要在 Task 2 中逐文件修复。

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): replace better-sqlite3 with sql.js adapter layer" \
  dashboard/package.json dashboard/pnpm-lock.yaml \
  dashboard/server/db.ts dashboard/instrumentation.ts dashboard/next.config.ts
```

---

## Task 2: 更新 sql.js 消费方 + 类型修复

**Files:**
- Modify: `dashboard/server/run-event-store.ts` — 类型导入
- Modify: `dashboard/server/projection-store.ts` — 类型导入
- Modify: `dashboard/server/access-gate.ts` — 类型导入
- Modify: `dashboard/server/device-identity.ts` — 类型导入

- [ ] **Step 1: 更新各文件的类型导入**

所有文件中将 `import type BetterSqlite3 from "better-sqlite3"` 改为从 `db.ts` 导入：

```ts
import type { Database } from "./db";
```

移除不再需要的 better-sqlite3 类型引用（`BetterSqlite3.Database`、`BetterSqlite3Factory` 等），统一使用 `Database`。

- [ ] **Step 2: 检查 run-event-store.ts 特殊用法**

该文件使用：
- `stmt.run()` 的 `info.changes` / `info.lastInsertRowid`（行 165, 419）
- `db.transaction()` 嵌套（行 165）
- 动态 SQL 构造 + `db.prepare()` 链式调用

确认适配层的 `run()` 返回值格式匹配。

- [ ] **Step 3: 检查 projection-store.ts 特殊用法**

该文件使用：
- 8 个懒初始化 prepared statements
- `info.lastInsertRowid` 追踪（行 119, 153, 167）
- UPSERT (INSERT ... ON CONFLICT)

确认 sql.js 支持 ON CONFLICT 语法（SQLite 3.24+，sql.js 内置 SQLite 满足）。

- [ ] **Step 4: 验证编译通过**

```bash
cd dashboard && pnpm tsc --noEmit
```

预期：零错误。

- [ ] **Step 5: 运行现有测试**

```bash
pnpm test -- dashboard/
```

修复因 sql.js 行为差异导致的测试失败。常见差异：
- `BigInt` vs `number` 在 lastInsertRowid
- `undefined` vs `null` 在空结果
- WASM 加载需要在测试 setup 中调用 `preloadSqlJs()`

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): update db consumers for sql.js adapter" \
  dashboard/server/run-event-store.ts dashboard/server/projection-store.ts \
  dashboard/server/access-gate.ts dashboard/server/device-identity.ts
```

---

## Task 3: Dockerfile.deck 简化 + Docker 重组

**Files:**
- Move: `deploy/docker-compose.yml` → `deploy/docker/docker-compose.yml`
- Move: `deploy/docker-compose.sandbox.yml` → `deploy/docker/docker-compose.sandbox.yml`
- Move: `deploy/Dockerfile.deck` → `deploy/docker/Dockerfile.deck`（并简化）

- [ ] **Step 1: 创建 deploy/docker/ 目录并移动文件**

```bash
mkdir -p deploy/docker
git mv deploy/docker-compose.yml deploy/docker/docker-compose.yml
git mv deploy/docker-compose.sandbox.yml deploy/docker/docker-compose.sandbox.yml
git mv deploy/Dockerfile.deck deploy/docker/Dockerfile.deck
```

- [ ] **Step 2: 简化 Dockerfile.deck**

从 `deploy/docker/Dockerfile.deck` 中删除所有 better-sqlite3 native addon 处理：

删除这些行：
```dockerfile
# 删除: sed 注入 onlyBuiltDependencies
RUN sed -i '/onlyBuiltDependencies:/a\  - better-sqlite3' pnpm-workspace.yaml && \
    pnpm install --frozen-lockfile --filter openclaw-deck...

# 替换为:
RUN pnpm install --frozen-lockfile --filter openclaw-deck...

# 删除: 整个 native addon 编译块
RUN cd node_modules/better-sqlite3 && \
    npx --yes prebuild-install || npx --yes node-gyp rebuild --release

# 删除: runtime 阶段的 native addon 复制
COPY --from=builder /app/node_modules/better-sqlite3/build \
  ./node_modules/better-sqlite3/build
```

- [ ] **Step 3: 更新 docker-compose.yml 路径**

更新 `build.context` 和 `dockerfile` 相对路径：

```yaml
services:
  gateway:
    build:
      context: ../..
      dockerfile: Dockerfile
      # ...
  deck:
    build:
      context: ../..
      dockerfile: deploy/docker/Dockerfile.deck
```

- [ ] **Step 4: 验证 Docker 构建**

```bash
cd deploy/docker && docker compose build
```

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] refactor(deploy): reorganize Docker files + simplify Dockerfile.deck" \
  deploy/docker/
```

---

## Task 4: seed.js 统一种子注入

**Files:**
- Create: `deploy/scripts/seed.js`
- Keep: `deploy/seed/` (不变)

- [ ] **Step 1: 创建 seed.js**

创建 `deploy/scripts/seed.js`。核心逻辑：

```js
#!/usr/bin/env node
/**
 * seed.js — Cross-platform seed injection for OpenClaw + Deck.
 *
 * Usage: node deploy/scripts/seed.js <target-dir> [--force]
 *
 * Environment variables (from .env):
 *   DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY,
 *   CPA_API_KEY, CPA_BASE_URL, OPENCLAW_GATEWAY_TOKEN,
 *   DEFAULT_MODEL, TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, "../seed");
const MARKER = ".seed-initialized";

const TEMPLATE_VARS = [
  "DEEPSEEK_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
  "CPA_API_KEY", "CPA_BASE_URL", "OPENCLAW_GATEWAY_TOKEN",
  "DEFAULT_MODEL", "TELEGRAM_BOT_TOKEN", "DISCORD_BOT_TOKEN",
];

// --- Helpers ---

function log(msg) { console.log(`[seed] ${msg}`); }

function renderTemplate(src) {
  let content = fs.readFileSync(src, "utf-8");
  for (const v of TEMPLATE_VARS) {
    content = content.replaceAll(`\${${v}}`, process.env[v] || "");
  }
  return content;
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function seedInitOnce(src, dst) {
  if (fs.existsSync(dst)) { log(`skip (exists): ${dst}`); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (src.endsWith(".tmpl")) {
    const rendered = renderTemplate(src);
    fs.writeFileSync(dst.replace(/\.tmpl$/, ""), rendered);
    log(`rendered: ${dst.replace(/\.tmpl$/, "")}`);
  } else if (fs.statSync(src).isDirectory()) {
    copyDirRecursive(src, dst);
    log(`copied dir: ${dst}`);
  } else {
    fs.copyFileSync(src, dst);
    log(`copied: ${dst}`);
  }
}

function seedAlwaysSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  copyDirRecursive(src, dst);
  log(`synced: ${dst}`);
}

function mergePluginsConfig(targetDir) {
  const pluginsFile = path.join(SEED_DIR, "plugins-config.json");
  const configFile = path.join(targetDir, "openclaw.json");
  if (!fs.existsSync(pluginsFile) || !fs.existsSync(configFile)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    const plugins = JSON.parse(fs.readFileSync(pluginsFile, "utf-8"));
    cfg.plugins = { ...cfg.plugins, ...plugins };
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
    log("merged plugins config");
  } catch (e) {
    log(`WARN: failed to merge plugins config: ${e.message}`);
  }
}

// --- Main ---

const targetDir = process.argv[2];
const force = process.argv.includes("--force");
if (!targetDir) { console.error("Usage: seed.js <target-dir> [--force]"); process.exit(1); }

fs.mkdirSync(targetDir, { recursive: true });
const markerPath = path.join(targetDir, MARKER);
const alreadyInit = fs.existsSync(markerPath) && !force;

if (alreadyInit) {
  log(`Already initialized. Syncing always-sync content only...`);
} else {
  // init-once: config
  seedInitOnce(path.join(SEED_DIR, "openclaw.json.tmpl"),
               path.join(targetDir, "openclaw.json.tmpl"));
  // init-once: agents
  const agentsDir = path.join(SEED_DIR, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const d of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (d.isDirectory()) seedInitOnce(path.join(agentsDir, d.name),
                                         path.join(targetDir, "agents", d.name));
    }
  }
  // init-once: cron
  const cronFile = path.join(SEED_DIR, "cron/jobs.json");
  if (fs.existsSync(cronFile)) seedInitOnce(cronFile, path.join(targetDir, "cron/jobs.json"));
  // init-once: extensions
  const extDir = path.join(SEED_DIR, "extensions");
  if (fs.existsSync(extDir)) {
    for (const d of fs.readdirSync(extDir, { withFileTypes: true })) {
      if (d.isDirectory()) seedInitOnce(path.join(extDir, d.name),
                                         path.join(targetDir, "extensions", d.name));
    }
  }
  // merge plugins config
  mergePluginsConfig(targetDir);
  // write marker
  fs.writeFileSync(markerPath, `v1 ${new Date().toISOString()}`);
  log("Seed marker written");
}

// always-sync: skills
const skillsDir = path.join(SEED_DIR, "skills");
if (fs.existsSync(skillsDir)) {
  for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (d.isDirectory()) seedAlwaysSync(path.join(skillsDir, d.name),
                                         path.join(targetDir, "skills", d.name));
  }
}

log("Seed injection complete.");
```

- [ ] **Step 2: 验证 seed.js**

```bash
# 创建临时测试目录
mkdir -p /tmp/test-seed
OPENCLAW_GATEWAY_TOKEN=test-token DEFAULT_MODEL=cpa/deepseek-chat \
  node deploy/scripts/seed.js /tmp/test-seed

# 验证输出
cat /tmp/test-seed/openclaw.json   # 应含 test-token
ls /tmp/test-seed/agents/main/     # 应存在
cat /tmp/test-seed/.seed-initialized  # 应存在

# 验证幂等性
node deploy/scripts/seed.js /tmp/test-seed  # 应输出 "skip" 和 "Already initialized"

rm -rf /tmp/test-seed
```

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add unified Node.js seed script" deploy/scripts/seed.js
```

---

## Task 5: PM2 ecosystem 模板 + 生成脚本

**Files:**
- Create: `deploy/ecosystem.config.cjs.tmpl`
- Create: `deploy/scripts/generate-ecosystem.js`

- [ ] **Step 1: 创建 ecosystem 模板**

创建 `deploy/ecosystem.config.cjs.tmpl`：

```js
// PM2 ecosystem configuration for OpenClaw + Deck.
// Generated by deploy/scripts/generate-ecosystem.js — do not edit manually.
module.exports = {
  apps: [
    {
      name: "openclaw-gateway",
      script: "openclaw.mjs",
      args: "gateway run --bind loopback --port __GATEWAY_PORT__ --force",
      cwd: "__REPO_DIR__",
      env: __GATEWAY_ENV__,
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: "openclaw-deck",
      script: ".next/standalone/dashboard/server.js",
      cwd: "__REPO_DIR__/dashboard",
      env: __DECK_ENV__,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
```

- [ ] **Step 2: 创建 generate-ecosystem.js**

创建 `deploy/scripts/generate-ecosystem.js`：

```js
#!/usr/bin/env node
/**
 * generate-ecosystem.js — Generate PM2 ecosystem.config.cjs from template + .env
 *
 * Usage: node deploy/scripts/generate-ecosystem.js <repo-dir>
 *
 * Reads environment variables (already loaded by install.sh) and generates
 * ecosystem.config.cjs with properly escaped values via JSON.stringify.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = process.argv[2] || path.resolve(__dirname, "../..");

const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(repoDir, "deploy/data/.openclaw");
const deckDataDir = process.env.DECK_DATA_DIR || path.join(repoDir, "deploy/data/openclaw-deck");
const gwPort = process.env.GATEWAY_PORT || "18789";
const dkPort = process.env.DECK_PORT || "3000";
const token = process.env.OPENCLAW_GATEWAY_TOKEN || "";

// Derive OPENCLAW_HOME from state dir
const openclawHome = stateDir.endsWith("/.openclaw") || stateDir.endsWith("\\.openclaw")
  ? path.dirname(stateDir)
  : stateDir;

// Collect provider env vars
const providerKeys = [
  "CPA_API_KEY", "CPA_BASE_URL", "DEEPSEEK_API_KEY",
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
  "TELEGRAM_BOT_TOKEN", "DISCORD_BOT_TOKEN",
];

const gatewayEnv = {
  NODE_ENV: "production",
  OPENCLAW_HOME: openclawHome,
  OPENCLAW_GATEWAY_TOKEN: token,
  NO_PROXY: "localhost,127.0.0.1",
};
for (const k of providerKeys) {
  if (process.env[k]) gatewayEnv[k] = process.env[k];
}

const deckEnv = {
  NODE_ENV: "production",
  PORT: dkPort,
  DECK_GATEWAY_URL: `ws://localhost:${gwPort}`,
  DECK_GATEWAY_TOKEN: token,
  DECK_DB_PATH: path.join(deckDataDir, "deck.db"),
  NO_PROXY: "localhost,127.0.0.1",
};

// Read template and replace placeholders with JSON-safe values
let tmpl = fs.readFileSync(path.join(__dirname, "../ecosystem.config.cjs.tmpl"), "utf-8");
tmpl = tmpl.replace("__REPO_DIR__", repoDir.replace(/\\/g, "\\\\"));
tmpl = tmpl.replace("__GATEWAY_PORT__", gwPort);
tmpl = tmpl.replace("__GATEWAY_ENV__", JSON.stringify(gatewayEnv, null, 6));
tmpl = tmpl.replace("__DECK_ENV__", JSON.stringify(deckEnv, null, 6));

const outPath = path.join(__dirname, "../ecosystem.config.cjs");
fs.writeFileSync(outPath, tmpl);
console.log(`[ecosystem] Generated: ${outPath}`);
```

- [ ] **Step 3: 验证生成**

```bash
OPENCLAW_GATEWAY_TOKEN=test123 DEEPSEEK_API_KEY=sk-xxx \
  node deploy/scripts/generate-ecosystem.js "$(pwd)"
cat deploy/ecosystem.config.cjs
# 应含 JSON.stringify 安全序列化的 env 对象
rm deploy/ecosystem.config.cjs
```

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add PM2 ecosystem template + generator" \
  deploy/ecosystem.config.cjs.tmpl deploy/scripts/generate-ecosystem.js
```

---

## Task 6: install.sh 统一安装脚本

**Files:**
- Create: `deploy/scripts/install.sh`
- Keep: `deploy/.env.example`

- [ ] **Step 1: 创建 install.sh**

创建 `deploy/scripts/install.sh`（~200 行），核心结构：

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect package root (install.sh can be at package-root/install.sh or deploy/scripts/install.sh)
if [ -f "$DEPLOY_DIR/../manifest.json" ]; then
  PACKAGE_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
else
  PACKAGE_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
fi

log() { echo "[install] $*"; }
err() { echo "[install] ERROR: $*" >&2; exit 1; }

# --- Platform detection ---
detect_platform() {
  case "$OSTYPE" in
    linux*)  echo "linux" ;;
    darwin*) echo "macos" ;;
    msys*|cygwin*|mingw*) echo "windows" ;;
    *)       echo "unknown" ;;
  esac
}

# --- Dependency checks ---
check_docker() { command -v docker >/dev/null && docker compose version >/dev/null 2>&1; }
check_node() {
  command -v node >/dev/null || return 1
  local v; v=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  [ "$v" -ge 22 ] 2>/dev/null
}
check_pnpm() { command -v pnpm >/dev/null 2>&1; }

print_install_guide() { ... }  # 各平台安装指引
check_dependencies() { ... }   # 依赖检测 + 指引输出
ensure_pm2() { command -v pm2 >/dev/null || npm i -g pm2; }

# --- .env management ---
ensure_env() { ... }  # 从 .env.example 创建 .env，自动生成 token

# --- Manifest reading ---
read_manifest() { ... }  # 解析 manifest.json，设置 HAS_IMAGES/HAS_PREBUILT/HAS_SOURCE

# --- Docker install ---
docker_install() {
  check_dependencies docker
  ensure_env
  local state_dir="${OPENCLAW_STATE_DIR:-$DEPLOY_DIR/data/.openclaw}"
  mkdir -p "$state_dir"

  cd "$DEPLOY_DIR/docker"

  # Load pre-built images if available
  if [ -d "$PACKAGE_ROOT/images" ]; then
    for img in "$PACKAGE_ROOT/images"/*.tar.gz; do
      [ -f "$img" ] || continue
      log "Loading $(basename "$img")..."
      docker load < "$img"
    done
  fi

  # Seed: run inside gateway container (no host Node.js needed)
  docker compose run --rm --no-deps -e OPENCLAW_GATEWAY_TOKEN -e DEFAULT_MODEL \
    gateway node /app/deploy/scripts/seed.js /home/node/.openclaw

  # Start
  if docker image inspect openclaw-gateway:package >/dev/null 2>&1; then
    docker compose -f docker-compose.package.yml up -d
  else
    docker compose up -d --build
  fi

  log "Waiting for services..."
  sleep 8
  docker compose ps
  # health check + success message
}

# --- Bare-metal install ---
bare_metal_install() {
  check_dependencies bare-metal
  ensure_env
  ensure_pm2

  local source_dir="$PACKAGE_ROOT/source"
  [ -d "$source_dir" ] || source_dir="$PACKAGE_ROOT"
  cd "$source_dir"

  # Build (skip if pre-built)
  if [ ! -f dist/cli-startup-metadata.json ]; then
    log "Installing dependencies..."
    pnpm install --frozen-lockfile
    log "Building Gateway..."
    pnpm build
  fi
  if [ ! -f dashboard/.next/standalone/dashboard/server.js ]; then
    log "Building Deck..."
    (cd dashboard && pnpm install && npx next build --webpack)
    # Copy static + public into standalone
    [ -d dashboard/.next/static ] && cp -r dashboard/.next/static dashboard/.next/standalone/dashboard/.next/static
    [ -d dashboard/public ] && cp -r dashboard/public dashboard/.next/standalone/dashboard/public
  fi

  # Seed
  local state_dir="${OPENCLAW_STATE_DIR:-$DEPLOY_DIR/data/.openclaw}"
  mkdir -p "$state_dir"
  node deploy/scripts/seed.js "$state_dir"

  # Generate PM2 config
  node deploy/scripts/generate-ecosystem.js "$source_dir"

  # Start
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
  log "Services started. Run 'pm2 startup' to enable auto-start on boot."
}

# --- Interactive menu ---
show_menu() { ... }  # 根据 manifest 显示可用模式

# --- Main ---
case "${1:-}" in
  docker)       docker_install ;;
  docker-build) FORCE_BUILD=1 docker_install ;;
  bare-metal)   bare_metal_install ;;
  "")           show_menu ;;
  *)            echo "Usage: $0 [docker|docker-build|bare-metal]"; exit 1 ;;
esac
```

上面是骨架，实际实现需要填入完整的函数体（依赖检测指引、菜单逻辑、健康检查等）。

- [ ] **Step 2: 创建顶层入口 install.sh**

package.sh 打包时在包根目录生成一个简单的转发脚本：

```bash
#!/usr/bin/env bash
exec "$(dirname "$0")/deploy/scripts/install.sh" "$@"
```

- [ ] **Step 3: 验证裸机模式（macOS）**

```bash
cd deploy && bash scripts/install.sh bare-metal
pm2 status  # 应显示 openclaw-gateway + openclaw-deck
pm2 stop all && pm2 delete all  # 清理
```

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): add unified install.sh with Docker/bare-metal modes" \
  deploy/scripts/install.sh
```

---

## Task 7: package.sh 重写

**Files:**
- Rewrite: `deploy/scripts/package.sh`

- [ ] **Step 1: 重写 package.sh**

核心变化：
- `stage_source()` 用 `git archive` 替代 rsync
- 新增 `stage_prebuilt()` 包含完整 standalone 产物
- `stage_images()` 保留但简化
- `stage_local()` 保留逻辑
- 新增 `manifest.json` 生成
- 新增打包后完整性验证
- 支持 `--with-images`、`--with-prebuilt`、`--full`、`--with-local`、`--platform`

关键函数：

```bash
stage_source() {
  log "Staging source via git archive..."
  cd "$REPO_DIR"
  git archive HEAD --prefix=source/ | tar -C "$STAGING_DIR" -x
  # git archive 天然排除 .git, .env, node_modules
  # 复制 deploy/ 脚本（可能未提交的）
  rsync -a --exclude='data' --exclude='.env' --exclude='*.tar.gz' --exclude='*.zip' \
    "$DEPLOY_DIR/" "$STAGING_DIR/source/deploy/"
  log "Source staged"
}

stage_prebuilt() {
  log "Staging pre-built artifacts..."
  local src="$STAGING_DIR/source"
  # Gateway dist
  [ -d "$REPO_DIR/dist" ] && cp -r "$REPO_DIR/dist" "$src/dist"
  # Deck standalone (complete: server + static + public + migrations + node_modules)
  local standalone="$REPO_DIR/dashboard/.next/standalone"
  if [ -d "$standalone" ]; then
    mkdir -p "$src/dashboard/.next"
    cp -r "$standalone" "$src/dashboard/.next/standalone"
    [ -d "$REPO_DIR/dashboard/.next/static" ] && \
      cp -r "$REPO_DIR/dashboard/.next/static" "$src/dashboard/.next/standalone/dashboard/.next/static"
    [ -d "$REPO_DIR/dashboard/public" ] && \
      cp -r "$REPO_DIR/dashboard/public" "$src/dashboard/.next/standalone/dashboard/public"
    [ -d "$REPO_DIR/dashboard/migrations" ] && \
      cp -r "$REPO_DIR/dashboard/migrations" "$src/dashboard/.next/standalone/dashboard/migrations"
  fi
  log "Pre-built artifacts staged"
}

write_manifest() {
  cat > "$STAGING_DIR/manifest.json" <<EOF
{
  "format": 1,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit": "$(cd "$REPO_DIR" && git rev-parse --short HEAD)",
  "branch": "$(cd "$REPO_DIR" && git branch --show-current)",
  "contents": {
    "source": true,
    "prebuilt": $HAS_PREBUILT,
    "dockerImages": $HAS_IMAGES,
    "dockerPlatform": "$DOCKER_PLATFORM",
    "localExtensions": $HAS_LOCAL
  }
}
EOF
}

verify_package() {
  log "Verifying package integrity..."
  local ok=true
  [ -f "$STAGING_DIR/manifest.json" ] || { log "FAIL: manifest.json missing"; ok=false; }
  [ -d "$STAGING_DIR/source" ] || { log "FAIL: source/ missing"; ok=false; }
  [ -f "$STAGING_DIR/source/deploy/scripts/install.sh" ] || { log "FAIL: install.sh missing"; ok=false; }
  if [ "$HAS_PREBUILT" = true ]; then
    [ -f "$STAGING_DIR/source/dist/cli-startup-metadata.json" ] || { log "FAIL: Gateway dist missing"; ok=false; }
    [ -f "$STAGING_DIR/source/dashboard/.next/standalone/dashboard/server.js" ] || { log "FAIL: Deck standalone missing"; ok=false; }
  fi
  [ "$ok" = true ] || err "Package verification failed"
  log "Package verified OK"
}
```

- [ ] **Step 2: 验证打包**

```bash
# A 模式
deploy/scripts/package.sh
ls -lh deploy/openclaw-deploy-*.tar.gz  # 应 ~50MB

# A+C 模式
deploy/scripts/package.sh --with-prebuilt
ls -lh deploy/openclaw-deploy-*.tar.gz  # 应 ~60MB
```

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deploy): rewrite package.sh with manifest + A/B/C layers" \
  deploy/scripts/package.sh
```

---

## Task 8: teardown.sh 更新

**Files:**
- Modify: `deploy/scripts/teardown.sh`

- [ ] **Step 1: 更新 teardown.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() { echo "[teardown] $*"; }

case "${1:-}" in
  docker)
    cd "$DEPLOY_DIR/docker"
    docker compose down --rmi local --volumes 2>/dev/null || true
    docker compose -f docker-compose.sandbox.yml down --rmi local --volumes 2>/dev/null || true
    log "Docker resources removed."
    ;;
  bare-metal)
    pm2 stop openclaw-gateway openclaw-deck 2>/dev/null || true
    pm2 delete openclaw-gateway openclaw-deck 2>/dev/null || true
    pm2 save --force 2>/dev/null || true
    log "PM2 processes removed."
    ;;
  all)
    "$0" docker
    "$0" bare-metal
    log "Removing data directories..."
    rm -rf "$DEPLOY_DIR/data"
    log "All data removed."
    ;;
  *)
    echo "Usage: $0 [docker | bare-metal | all]"
    exit 1
    ;;
esac
```

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] refactor(deploy): update teardown.sh for PM2 + docker/" \
  deploy/scripts/teardown.sh
```

---

## Task 9: 文档（README.md + INSTALL.md + CLAUDE.md）

**Files:**
- Rewrite: `deploy/README.md`
- Create: `deploy/INSTALL.md`
- Rewrite: `deploy/CLAUDE.md`

- [ ] **Step 1: 重写 README.md**

完整运维手册，包含：
- 架构图（Gateway:18789 → Deck:3000 → Browser）
- 部署模式对比表（Docker / Docker Build / 裸机）
- 打包命令和参数（A/B/C 叠加层）
- 环境变量说明表
- 数据目录结构
- 种子定制（seed/ 策略）
- 升级流程（Docker / 裸机）
- 分离部署说明
- 故障排查表
- 管理命令速查

- [ ] **Step 2: 创建 INSTALL.md**

安装包内附带的快速指南：
- 各平台前置依赖表 + 安装命令
- 快速开始 3 步走（Docker / 裸机）
- 安装后管理命令（Docker compose / PM2）
- 故障排查 TOP 5

- [ ] **Step 3: 重写 CLAUDE.md**

AI 操作指引，确保 Claude Code 在未来迭代中正确操作。包含：

**关键文件索引**：

| 文件 | 用途 | 何时修改 |
|------|------|---------|
| `scripts/install.sh` | 统一安装入口 | 新增安装模式或依赖时 |
| `scripts/package.sh` | 打包入口 | 新增打包层时 |
| `scripts/seed.js` | 种子注入 | 新增 seed 内容或模板变量时 |
| `scripts/generate-ecosystem.js` | PM2 配置生成 | 修改启动参数或 env 时 |
| `docker/docker-compose.yml` | Docker 编排 | 修改容器配置时 |
| `docker/Dockerfile.deck` | Deck 镜像 | 修改 Deck 依赖时 |
| `ecosystem.config.cjs.tmpl` | PM2 模板 | 修改启动参数时 |
| `.env.example` | 环境变量模板 | 新增 env var 时 |
| `seed/openclaw.json.tmpl` | 配置模板 | 修改默认配置时 |

**演进契约**：

```
当修改以下文件时，检查是否需要同步更新 deploy/ 下的对应文件：
- package.json (bin/scripts/deps) → ecosystem.config.cjs.tmpl, Dockerfile
- dashboard/package.json (deps) → Dockerfile.deck
- src/gateway/ (启动参数) → ecosystem.config.cjs.tmpl, docker-compose.yml command
- .env 新增变量 → .env.example, seed.js TEMPLATE_VARS, generate-ecosystem.js providerKeys
- openclaw.json schema → seed/openclaw.json.tmpl
```

**部署命令序列**：Docker / 裸机各步骤完整命令。

**架构约束**：Gateway 源码运行、Docker 网络共享、seed 策略、PM2 配置。

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] docs(deploy): rewrite README + INSTALL + CLAUDE for new deploy system" \
  deploy/README.md deploy/INSTALL.md deploy/CLAUDE.md
```

---

## Task 10: 删除旧文件 + 最终清理

**Files:**
- Delete: `deploy/bare-metal/` 整个目录
- Delete: `deploy/scripts/setup.sh`
- Delete: `deploy/scripts/seed.sh`

- [ ] **Step 1: 删除旧文件**

```bash
rm -rf deploy/bare-metal/
rm -f deploy/scripts/setup.sh
rm -f deploy/scripts/seed.sh
```

- [ ] **Step 2: 验证目录结构**

```bash
find deploy -type f | sort
```

应只剩：
```
deploy/.env.example
deploy/.gitignore
deploy/CLAUDE.md
deploy/INSTALL.md
deploy/README.md
deploy/docker/Dockerfile.deck
deploy/docker/docker-compose.sandbox.yml
deploy/docker/docker-compose.yml
deploy/ecosystem.config.cjs.tmpl
deploy/scripts/generate-ecosystem.js
deploy/scripts/install.sh
deploy/scripts/package.sh
deploy/scripts/seed.js
deploy/scripts/teardown.sh
deploy/seed/README.md
deploy/seed/agents/main/IDENTITY.md
deploy/seed/agents/main/agent/models.json
deploy/seed/cron/jobs.json
deploy/seed/openclaw.json.tmpl
```

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] chore(deploy): remove legacy deploy scripts (bare-metal/, setup.sh, seed.sh)" \
  deploy/bare-metal/ deploy/scripts/setup.sh deploy/scripts/seed.sh
```

---

## Task 11: 集成验证

- [ ] **Step 1: TypeScript 编译检查**

```bash
cd dashboard && pnpm tsc --noEmit
```

预期：零错误。

- [ ] **Step 2: Dashboard 测试**

```bash
pnpm test -- dashboard/
```

预期：全部通过（sql.js 适配层兼容）。

- [ ] **Step 3: Docker 模式端到端验证**

```bash
cd deploy
cp .env.example .env
# 编辑 .env 设置 API key
bash scripts/install.sh docker-build
# 验证
curl -sf http://localhost:18789/healthz  # Gateway 健康
curl -sf http://localhost:3000           # Deck 可访问
# 清理
bash scripts/teardown.sh docker
```

- [ ] **Step 4: 裸机模式端到端验证（macOS）**

```bash
bash deploy/scripts/install.sh bare-metal
pm2 status                              # 两个服务 online
curl -sf http://localhost:18789/healthz  # Gateway 健康
curl -sf http://localhost:3000           # Deck 可访问
pm2 stop all && pm2 delete all          # 清理
```

- [ ] **Step 5: 打包验证**

```bash
deploy/scripts/package.sh --with-prebuilt
# 解压到临时目录验证
mkdir /tmp/test-pkg && tar xzf deploy/openclaw-deploy-*.tar.gz -C /tmp/test-pkg
cat /tmp/test-pkg/openclaw-deploy-*/manifest.json  # 验证 manifest
ls /tmp/test-pkg/openclaw-deploy-*/source/dist/    # 验证 prebuilt
rm -rf /tmp/test-pkg
```

- [ ] **Step 6: 更新根目录 CLAUDE.md 的 deploy 相关章节**

更新 `CLAUDE.md` 中 `### Deck 开发环境` 和 deploy 相关的引用路径（`docker-compose.yml` → `deploy/docker/docker-compose.yml` 等）。

- [ ] **Step 7: Final commit**

```bash
scripts/committer "[enhanced] chore(deploy): update root CLAUDE.md for new deploy structure" CLAUDE.md
```
