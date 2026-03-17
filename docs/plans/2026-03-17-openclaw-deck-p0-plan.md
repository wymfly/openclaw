# openclaw-deck P0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish foundation infrastructure and 4 core panels — Gateway connected, chat working with streaming, agents/models manageable.

**Architecture:** Next.js 15+ App Router SPA, server-side WS connection to OpenClaw Gateway (Protocol v3), SQLite for deck state, EventBus + SSE for real-time browser delivery.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand, better-sqlite3, ws, next-intl, react-markdown

---

## Chunk 1: Infrastructure (Tasks 1–8)

<!-- PARALLEL GROUP START: Tasks 1-2 have no dependencies -->

### Task 1: Project Scaffold [infra]

covers: tasks.md > 1.1 > "Create dashboard/ directory with package.json"

**Files:**

- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/next.config.ts`
- Create: `dashboard/.gitignore`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: 创建 dashboard 目录并初始化 package.json**

在 `pnpm-workspace.yaml` 的 `packages:` 列表中添加 `- dashboard`，使其成为 monorepo 的一部分。

创建 `dashboard/package.json`：

```json
{
  "name": "openclaw-deck",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

修改 `pnpm-workspace.yaml`，在 `packages:` 末尾添加：

```yaml
- dashboard
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@server/*": ["./server/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 服务端需要加载 native 模块（better-sqlite3, ws）
  serverExternalPackages: ["better-sqlite3", "ws"],
  // 支持 standalone 输出用于 Docker 部署
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4: 创建 dashboard/.gitignore**

```
.next/
node_modules/
*.db
*.db-wal
*.db-shm
```

- [ ] **Step 5: 验证 scaffold**

```bash
cd dashboard && pnpm install && pnpm build
```

确认构建通过后 commit：`[enhanced] feat(deck): scaffold dashboard project`

---

### Task 2: Core Dependencies [infra]

covers: tasks.md > 1.2 > "Install core dependencies" + 1.3 > "Configure shadcn/ui"

depends: Task 1

**Files:**

- Modify: `dashboard/package.json`
- Create: `dashboard/src/app/globals.css`
- Create: `dashboard/tailwind.config.ts`
- Create: `dashboard/postcss.config.mjs`
- Create: `dashboard/components.json`

- [ ] **Step 1: 安装运行时依赖**

```bash
cd dashboard
pnpm add next@latest react@latest react-dom@latest typescript@latest
pnpm add tailwindcss@latest postcss autoprefixer
pnpm add better-sqlite3 ws zustand next-intl lucide-react
pnpm add react-markdown remark-gfm
pnpm add -D @types/better-sqlite3 @types/ws @types/react @types/react-dom
pnpm add -D vitest @vitejs/plugin-react
```

- [ ] **Step 2: 初始化 Tailwind CSS**

创建 `dashboard/tailwind.config.ts`：

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // shadcn/ui CSS variable 体系
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 3: 创建 globals.css（含 dark/light CSS variables）**

创建 `dashboard/src/app/globals.css`，包含 shadcn/ui 标准 CSS variables（light 和 dark 两套）以及 Tailwind 指令。

- [ ] **Step 4: 初始化 shadcn/ui**

```bash
cd dashboard
npx shadcn@latest init
```

选择 New York style、Slate base color。确认 `components.json` 生成。

安装基础组件：

```bash
npx shadcn@latest add button card input label tabs scroll-area separator badge tooltip dialog dropdown-menu collapsible sheet toast
```

- [ ] **Step 5: 验证依赖安装**

```bash
cd dashboard && pnpm build
```

确认构建通过后 commit：`[enhanced] feat(deck): install core dependencies and configure shadcn/ui`

<!-- PARALLEL GROUP END -->

---

### Task 3: Transplant WS Adapter + Extend Allowlist [transplant]

covers: gateway-communication/spec.md > WebSocket Gateway Adapter > "Successful connection and authentication" + "Automatic reconnection on disconnect"

depends: Task 2

**Files:**

- Create: `dashboard/server/gateway-adapter.ts`
- Create: `dashboard/server/contracts.ts`
- Test: `dashboard/server/__tests__/gateway-adapter.test.ts`

**Source:**

- `vendor/openclaw-studio/src/lib/controlplane/openclaw-adapter.ts` (511 LOC)
- `vendor/openclaw-studio/src/lib/controlplane/contracts.ts` (55 LOC)

- [ ] **Step 1: 编写 gateway-adapter 测试**

先编写测试再实现（TDD）。创建 `dashboard/server/__tests__/gateway-adapter.test.ts`：

测试用例覆盖：

1. `constructor` — 可通过 options 注入 `loadSettings`、`createWebSocket`、`methodAllowlist`
2. `start()` — 建立连接、完成 challenge-response 认证
3. `request()` — 发送 RPC 请求、处理响应
4. `request()` — 方法不在 allowlist 中时抛错
5. `stop()` — 清理所有 pending request 和 timer
6. 断线重连 — 指数退避（1s 起步，最大 30s）
7. 认证失败 — 不重连，状态变为 `error`
8. 扩展 allowlist 包含 Deck 需要的全部方法

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
// 使用 mock WebSocket 替代真实连接
// 验证 challenge → connect request → response 流程
```

- [ ] **Step 2: 移植 contracts.ts**

从 `vendor/openclaw-studio/src/lib/controlplane/contracts.ts` 复制到 `dashboard/server/contracts.ts`。

改动点：

- 无依赖，直接复制
- 保留所有类型定义不变

- [ ] **Step 3: 移植 gateway-adapter.ts 并扩展 allowlist**

从 `vendor/openclaw-studio/src/lib/controlplane/openclaw-adapter.ts` 复制到 `dashboard/server/gateway-adapter.ts`。

**必须修改的内容：**

1. **Import 路径**：将 `@/lib/controlplane/contracts` 改为 `@server/contracts`
2. **移除 `loadStudioSettings` 依赖**：删除对 `@/lib/studio/settings-store` 的 import，将 `loadGatewaySettings` 改为从环境变量或配置文件读取
3. **Client ID 更新**：将 `CONNECT_CLIENT_ID_BACKEND` 改为 `"openclaw-deck"`（参考 `src/gateway/protocol/client-info.ts` 中已有的 ID 列表，需注册新的 client ID）
4. **扩展 DEFAULT_METHOD_ALLOWLIST**：在现有列表基础上添加以下方法（这是 Deck 所有面板需要的 RPC）：

```typescript
const DEFAULT_METHOD_ALLOWLIST = new Set<string>([
  // --- 原有 ---
  "status",
  "chat.send",
  "chat.abort",
  "chat.history",
  "agents.create",
  "agents.update",
  "agents.delete",
  "agents.list",
  "agents.files.get",
  "agents.files.set",
  "agents.files.list", // 新增：agent 文件浏览
  "sessions.list",
  "sessions.preview",
  "sessions.patch",
  "sessions.reset",
  "sessions.delete", // 新增：session 删除
  "cron.list",
  "cron.run",
  "cron.remove",
  "cron.add",
  "cron.update", // 新增：cron 编辑
  "config.get",
  "config.set",
  "config.patch", // 新增：config 局部更新
  "config.schema", // 新增：获取配置 JSON Schema
  "config.apply", // 新增：应用配置（含 baseHash 冲突检测）
  "models.list",
  "exec.approval.resolve",
  "exec.approvals.get",
  "exec.approvals.set",
  "agent.wait",
  // --- P0 新增 ---
  "health", // Gateway Overview 面板
  "usage.status", // Usage 面板
  "usage.cost", // Usage 面板
  "sessions.usage", // Sessions 面板
  "sessions.usage.timeseries", // Usage 图表
  "sessions.usage.logs", // Usage 日志
  "channels.status", // Channels 面板
  "channels.logout", // Channels 面板
  "logs.tail", // Logs 面板
  "doctor.memory.status", // Memory 面板
  "cron.status", // Cron 面板
  "cron.runs", // Cron 面板
  "skills.status", // Skills 面板
  "skills.update", // Skills 面板
]);
```

5. **settings loader 改造**：替换 `loadGatewaySettings` 函数，从 `process.env.DECK_GATEWAY_URL` 和 `process.env.DECK_GATEWAY_TOKEN` 读取，或者从 SQLite settings 表读取：

```typescript
const loadGatewaySettings = (): ControlPlaneGatewaySettings => {
  // 优先从环境变量读取（兼容 Docker 部署）
  const envUrl = process.env.DECK_GATEWAY_URL?.trim();
  const envToken = process.env.DECK_GATEWAY_TOKEN?.trim();
  if (envUrl && envToken) return { url: envUrl, token: envToken };
  // 降级到 SQLite settings 表（由 Onboarding Wizard 写入）
  // 此处由 server-runtime 注入 getSettings 回调
  throw new Error("Gateway URL and token not configured. Run the onboarding wizard.");
};
```

- [ ] **Step 4: 运行测试**

```bash
cd dashboard && pnpm test -- server/__tests__/gateway-adapter.test.ts
```

确认全部通过后 commit：`[enhanced] feat(deck): transplant WS adapter with extended method allowlist`

---

### Task 4: Transplant EventBus + SSE [transplant]

covers: gateway-communication/spec.md > EventBus Internal Routing > "Gateway event propagation" + "Subscriber isolation" + SSE Stream Bridge > "Browser receives real-time events" + "SSE reconnection with last-event-id"

depends: Task 3

**Files:**

- Create: `dashboard/server/event-bus.ts`
- Create: `dashboard/src/app/api/stream/route.ts`
- Test: `dashboard/server/__tests__/event-bus.test.ts`
- Test: `dashboard/src/app/api/stream/__tests__/route.test.ts`

**Source:**

- `vendor/mission-control/src/lib/event-bus.ts` (64 LOC)

- [ ] **Step 1: 编写 EventBus 测试**

```typescript
// dashboard/server/__tests__/event-bus.test.ts
import { describe, it, expect, vi } from "vitest";

describe("EventBus", () => {
  it("广播事件到所有订阅者", () => {
    /* ... */
  });
  it("订阅者抛错不影响其他订阅者", () => {
    /* ... */
  });
  it("单例模式（HMR 安全）", () => {
    /* ... */
  });
  it("支持 Deck 自定义事件类型", () => {
    /* ... */
  });
});
```

- [ ] **Step 2: 移植 event-bus.ts 并适配 Deck 事件类型**

从 `vendor/mission-control/src/lib/event-bus.ts` 复制到 `dashboard/server/event-bus.ts`。

**改动点：**

1. **EventType 替换**：删除 MC 的事件类型，替换为 Deck 事件类型：

```typescript
export type EventType =
  | "runtime.status" // 连接状态变更
  | "gateway.event" // Gateway WS 事件透传
  | "chat.delta" // 聊天流式 token
  | "chat.final" // 聊天完成
  | "chat.error" // 聊天错误
  | "agent.updated" // Agent 状态变更
  | "gateway.health" // 健康检查更新
  | "notification.toast"; // Toast 通知
```

2. **添加 subscriber 错误隔离**：在 `broadcast` 方法中 try-catch 每个 subscriber callback（spec 要求）：

```typescript
broadcast(type: EventType, data: unknown): ServerEvent {
  const event: ServerEvent = { type, data, timestamp: Date.now() };
  // 遍历 listeners 时隔离错误，确保一个失败不影响其他
  for (const listener of this.listeners("server-event")) {
    try {
      (listener as (e: ServerEvent) => void)(event);
    } catch (err) {
      console.error(`EventBus subscriber error for ${type}:`, err);
    }
  }
  return event;
}
```

3. **globalThis 单例保持不变**（Next.js HMR 安全）

- [ ] **Step 3: 实现 SSE stream endpoint**

创建 `dashboard/src/app/api/stream/route.ts`：

```typescript
import { eventBus } from "@server/event-bus";
// 后续 Task 5 实现 projection-store 后添加 replay 逻辑

export async function GET(request: Request): Promise<Response> {
  const lastEventId = request.headers.get("Last-Event-ID");

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // 心跳：每 30s 发送 comment 防止连接超时
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      // 订阅 EventBus
      const handler = (event: { type: string; data: unknown; timestamp: number }) => {
        const id = String(event.timestamp); // 暂用 timestamp 作为 ID，Task 5 后改为 seq_id
        const payload = JSON.stringify({ type: event.type, data: event.data });
        controller.enqueue(encoder.encode(`id: ${id}\nevent: ${event.type}\ndata: ${payload}\n\n`));
      };

      eventBus.on("server-event", handler);

      // 清理
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        eventBus.off("server-event", handler);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx 透传
    },
  });
}
```

- [ ] **Step 4: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- server/__tests__/event-bus.test.ts
```

commit：`[enhanced] feat(deck): transplant EventBus and implement SSE stream endpoint`

---

### Task 5: SQLite + Projection Store [backend]

covers: gateway-communication/spec.md > SQLite Projection Store > "Event persistence" + "Event replay for SSE catch-up"

depends: Task 4

**Files:**

- Create: `dashboard/server/db.ts`
- Create: `dashboard/server/projection-store.ts`
- Create: `dashboard/migrations/001_init.sql`
- Test: `dashboard/server/__tests__/projection-store.test.ts`

- [ ] **Step 1: 编写 projection store 测试**

```typescript
// dashboard/server/__tests__/projection-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("ProjectionStore", () => {
  it("写入事件并分配单调递增 seq_id", () => {
    /* ... */
  });
  it("按 seq_id 查询后续事件（用于 SSE replay）", () => {
    /* ... */
  });
  it("幂等写入（相同 connectionEpoch + seq 不重复插入）", () => {
    /* ... */
  });
  it("WAL 模式启用", () => {
    /* ... */
  });
});
```

- [ ] **Step 2: 创建 SQLite 初始化模块 db.ts**

```typescript
// dashboard/server/db.ts
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = process.env.DECK_DB_PATH || join(process.cwd(), "deck.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  // WAL 模式：更好的并发读写性能
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  // 确保 schema_version 表存在
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const currentVersion =
    (db.prepare("SELECT MAX(version) as v FROM schema_version").get() as { v: number | null })?.v ??
    0;

  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split("_")[0], 10);
    if (version <= currentVersion) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
  }
}

// globalThis 单例（HMR 安全）
const g = globalThis as typeof globalThis & { __deckDb?: Database.Database };
if (g.__deckDb) db = g.__deckDb;
export function initDb(): Database.Database {
  const instance = getDb();
  g.__deckDb = instance;
  return instance;
}
```

- [ ] **Step 3: 创建 001_init.sql 迁移**

```sql
-- migrations/001_init.sql
-- 事件 outbox：用于 SSE replay 和事件持久化
CREATE TABLE IF NOT EXISTS event_outbox (
  seq_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT    NOT NULL,
  payload      TEXT    NOT NULL,  -- JSON
  connection_epoch TEXT,          -- 用于幂等去重
  gateway_seq  INTEGER,           -- Gateway 原始 seq（可选）
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(connection_epoch, gateway_seq)  -- 幂等约束
);

CREATE INDEX IF NOT EXISTS idx_outbox_type ON event_outbox(event_type);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON event_outbox(created_at);

-- Deck 设置表（theme, language, gateway url/token 等）
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 预置默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'system');
INSERT OR IGNORE INTO settings (key, value) VALUES ('locale', 'zh');
```

- [ ] **Step 4: 实现 projection-store.ts**

```typescript
// dashboard/server/projection-store.ts
import type Database from "better-sqlite3";
import type { ControlPlaneDomainEvent } from "@server/contracts";

export class ProjectionStore {
  private insertStmt: Database.Statement;
  private replayStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO event_outbox (event_type, payload, connection_epoch, gateway_seq)
      VALUES (?, ?, ?, ?)
    `);
    this.replayStmt = db.prepare(`
      SELECT seq_id, event_type, payload, created_at
      FROM event_outbox
      WHERE seq_id > ?
      ORDER BY seq_id ASC
      LIMIT 1000
    `);
  }

  /** 持久化一个事件，返回 seq_id */
  write(event: ControlPlaneDomainEvent): number {
    const eventType = event.type;
    const payload = JSON.stringify(event);
    const epoch = event.type === "gateway.event" ? (event.connectionEpoch ?? null) : null;
    const gatewaySec = event.type === "gateway.event" ? event.seq : null;

    const result = this.insertStmt.run(eventType, payload, epoch, gatewaySec);
    return Number(result.lastInsertRowid);
  }

  /** 重放 afterSeqId 之后的事件（用于 SSE Last-Event-ID 恢复） */
  replay(afterSeqId: number): Array<{
    seqId: number;
    eventType: string;
    payload: string;
    createdAt: string;
  }> {
    return this.replayStmt.all(afterSeqId) as Array<{
      seqId: number;
      eventType: string;
      payload: string;
      createdAt: string;
    }>;
  }

  /** 获取 outbox 最新 seq_id */
  head(): number {
    const row = this.db.prepare("SELECT MAX(seq_id) as head FROM event_outbox").get() as {
      head: number | null;
    };
    return row?.head ?? 0;
  }
}
```

- [ ] **Step 5: 更新 SSE endpoint 使用 projection store 的 seq_id 作为 event ID**

修改 `dashboard/src/app/api/stream/route.ts`，在连接时如果有 `Last-Event-ID` header，先从 projection store replay 缺失的事件。

- [ ] **Step 6: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- server/__tests__/projection-store.test.ts
```

commit：`[enhanced] feat(deck): implement SQLite projection store with migration system`

---

### Task 6: Access Gate + Rate Limiter [transplant]

covers: gateway-communication/spec.md > Browser Isolation > "No direct Gateway access from browser"

depends: Task 2

**Files:**

- Create: `dashboard/server/access-gate.ts`
- Create: `dashboard/server/rate-limit.ts`
- Test: `dashboard/server/__tests__/access-gate.test.ts`
- Test: `dashboard/server/__tests__/rate-limit.test.ts`

**Source:**

- `vendor/openclaw-studio/server/access-gate.js` (91 LOC) — cookie-based access gate
- `vendor/openclaw-control-center/src/runtime/local-token-auth.ts` (70 LOC) — token auth
- `vendor/mission-control/src/lib/rate-limit.ts` (201 LOC) — IP rate limiter

- [ ] **Step 1: 编写 access-gate 测试**

```typescript
// dashboard/server/__tests__/access-gate.test.ts
describe("AccessGate", () => {
  it("token 未配置时放行所有请求", () => {
    /* ... */
  });
  it("cookie 中有正确 token 时放行", () => {
    /* ... */
  });
  it("query param 中有 token 时设置 cookie 并重定向", () => {
    /* ... */
  });
  it("API 请求无 token 时返回 401", () => {
    /* ... */
  });
  it("支持 Authorization Bearer header", () => {
    /* ... */
  });
});
```

- [ ] **Step 2: 移植并合并 access-gate.ts**

合并 Studio 的 cookie gate 和 Control Center 的 local-token-auth 为统一的 TypeScript 模块。

核心设计：

- 环境变量 `DECK_ACCESS_TOKEN` 控制是否启用
- 支持三种认证方式：cookie（浏览器）、Bearer header（API 客户端/platform proxy）、query param（首次设置）
- 从 Control Center 复用 `normalizeToken` 和 `readAuthorizationBearer` 函数
- 导出 Next.js middleware 兼容的 `checkAccess(request: Request)` 函数

```typescript
// dashboard/server/access-gate.ts
// 合并自：
// - vendor/openclaw-studio/server/access-gate.js (cookie gate)
// - vendor/openclaw-control-center/src/runtime/local-token-auth.ts (token normalization)

export interface AccessGateConfig {
  token: string; // DECK_ACCESS_TOKEN
  cookieName?: string; // 默认 "deck_access"
  queryParam?: string; // 默认 "access_token"
}

export function createAccessGate(config: AccessGateConfig) {
  // ...合并实现
}
```

- [ ] **Step 3: 移植 rate-limit.ts**

从 `vendor/mission-control/src/lib/rate-limit.ts` 复制到 `dashboard/server/rate-limit.ts`。

**改动点：**

1. 移除 `logSecurityEvent` 依赖（Deck 无安全日志表）— 改为 `console.warn`
2. 移除 `MC_DISABLE_RATE_LIMIT` 环境变量 — 改为 `DECK_DISABLE_RATE_LIMIT`
3. 移除 `MC_TRUSTED_PROXIES` — 改为 `DECK_TRUSTED_PROXIES`
4. 保留 `createRateLimiter`、`extractClientIp`，删除不需要的 `createAgentRateLimiter`
5. 导出三个预置 limiter：`apiReadLimiter`(120/min)、`apiMutationLimiter`(60/min)、`apiHeavyLimiter`(10/min)

- [ ] **Step 4: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- server/__tests__/access-gate.test.ts server/__tests__/rate-limit.test.ts
```

commit：`[enhanced] feat(deck): transplant access gate and rate limiter`

---

### Task 7: Server Runtime Singleton [backend]

covers: tasks.md > 1.11 > "Implement server runtime singleton"

depends: Task 3, Task 4, Task 5, Task 6

**Files:**

- Create: `dashboard/server/runtime.ts`
- Test: `dashboard/server/__tests__/runtime.test.ts`

- [ ] **Step 1: 编写 runtime 测试**

```typescript
describe("ServerRuntime", () => {
  it("初始化时创建 gateway adapter、db、event bus、projection store", () => {});
  it("gateway adapter 事件自动转发到 event bus", () => {});
  it("gateway adapter 事件自动写入 projection store", () => {});
  it("单例模式（HMR 安全）", () => {});
  it("shutdown 时清理所有资源", () => {});
});
```

- [ ] **Step 2: 实现 server runtime**

```typescript
// dashboard/server/runtime.ts
// 服务端运行时单例：在 Next.js 启动时初始化所有基础设施
// Gateway Adapter + SQLite + EventBus + ProjectionStore 的组装点

import { OpenClawGatewayAdapter } from "@server/gateway-adapter";
import { eventBus } from "@server/event-bus";
import { initDb } from "@server/db";
import { ProjectionStore } from "@server/projection-store";
import type { ControlPlaneDomainEvent } from "@server/contracts";

export interface ServerRuntime {
  gateway: OpenClawGatewayAdapter;
  projectionStore: ProjectionStore;
  db: ReturnType<typeof initDb>;
}

let runtime: ServerRuntime | null = null;

export function getRuntime(): ServerRuntime {
  if (runtime) return runtime;

  const db = initDb();
  const projectionStore = new ProjectionStore(db);

  const gateway = new OpenClawGatewayAdapter({
    // settings 从 SQLite 或环境变量加载
    loadSettings: () => loadSettingsFromDbOrEnv(db),
    onDomainEvent: (event: ControlPlaneDomainEvent) => {
      // 1. 持久化到 projection store
      projectionStore.write(event);
      // 2. 广播到 EventBus（SSE bridge 会消费）
      eventBus.broadcast(event.type as any, event);
    },
  });

  // 自动启动连接（settings 存在时）
  try {
    const settings = loadSettingsFromDbOrEnv(db);
    if (settings.url && settings.token) {
      void gateway.start().catch((err) => {
        console.error("Gateway initial connection failed:", err.message);
      });
    }
  } catch {
    // 未配置时静默跳过，等 Onboarding Wizard 设置
  }

  runtime = { gateway, projectionStore, db };

  // HMR 安全
  const g = globalThis as typeof globalThis & { __deckRuntime?: ServerRuntime };
  g.__deckRuntime = runtime;

  return runtime;
}

function loadSettingsFromDbOrEnv(db: ReturnType<typeof initDb>) {
  const envUrl = process.env.DECK_GATEWAY_URL?.trim();
  const envToken = process.env.DECK_GATEWAY_TOKEN?.trim();
  if (envUrl && envToken) return { url: envUrl, token: envToken };

  const urlRow = db.prepare("SELECT value FROM settings WHERE key = ?").get("gateway_url") as
    | { value: string }
    | undefined;
  const tokenRow = db.prepare("SELECT value FROM settings WHERE key = ?").get("gateway_token") as
    | { value: string }
    | undefined;

  const url = urlRow?.value?.trim() ?? "";
  const token = tokenRow?.value?.trim() ?? "";
  if (!url || !token) {
    throw new Error("Gateway not configured.");
  }
  return { url, token };
}
```

- [ ] **Step 3: 创建 instrumentation.ts（Next.js 服务端初始化钩子）**

```typescript
// dashboard/src/instrumentation.ts
// Next.js 14+ 的 instrumentation hook，在服务端启动时执行一次
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 初始化服务端运行时单例
    const { getRuntime } = await import("@server/runtime");
    getRuntime();
  }
}
```

在 `next.config.ts` 中启用：

```typescript
const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  // ...
};
```

- [ ] **Step 4: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- server/__tests__/runtime.test.ts
```

commit：`[enhanced] feat(deck): implement server runtime singleton with auto-connect`

---

### Task 8: i18n + Zustand + Layout Shell [frontend]

covers: tasks.md > 1.13 + 1.14 + 1.15

depends: Task 2

**Files:**

- Create: `dashboard/src/i18n/zh.json`
- Create: `dashboard/src/i18n/en.json`
- Create: `dashboard/src/i18n/request.ts`
- Create: `dashboard/src/stores/gateway.ts`
- Create: `dashboard/src/stores/chat.ts`
- Create: `dashboard/src/stores/agents.ts`
- Create: `dashboard/src/stores/ui.ts`
- Create: `dashboard/src/stores/notifications.ts`
- Create: `dashboard/src/components/layout/nav-rail.tsx`
- Create: `dashboard/src/components/layout/header-bar.tsx`
- Create: `dashboard/src/components/layout/shell.tsx`
- Create: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/[[...panel]]/page.tsx`
- Test: `dashboard/src/stores/__tests__/gateway.test.ts`

<!-- PARALLEL GROUP START: i18n, stores, layout 可以并行 -->

- [ ] **Step 1: 配置 next-intl**

创建 `dashboard/src/i18n/request.ts`：

```typescript
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  // 从 cookie 或默认 locale 读取
  const locale = "zh"; // 后续从 settings 读取
  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});
```

创建 `dashboard/src/i18n/zh.json`（中文默认）：

```json
{
  "nav": {
    "core": "核心",
    "chat": "对话",
    "agents": "智能体",
    "gateway": "网关概览",
    "models": "模型",
    "observe": "观测",
    "automate": "自动化",
    "control": "控制",
    "settings": "设置"
  },
  "header": {
    "connected": "已连接",
    "disconnected": "未连接",
    "reconnecting": "重连中",
    "error": "连接错误"
  },
  "chat": {
    "inputPlaceholder": "输入消息...",
    "send": "发送",
    "abort": "停止",
    "thinking": "思考中",
    "newSession": "新对话",
    "sessions": "对话列表",
    "selectAgent": "选择智能体",
    "dropFile": "拖拽文件到此处"
  },
  "agents": {
    "title": "智能体管理",
    "create": "创建智能体",
    "delete": "删除",
    "confirmDelete": "确定要删除智能体 {name} 吗？",
    "model": "模型",
    "personality": "人格文件",
    "workspace": "工作区",
    "files": "文件"
  },
  "gateway": {
    "title": "网关概览",
    "status": "连接状态",
    "health": "健康状态",
    "heartbeat": "心跳",
    "state": "运行状态",
    "diagnostics": "诊断",
    "active": "活跃",
    "paused": "暂停",
    "latency": "延迟"
  },
  "models": {
    "title": "模型管理",
    "catalog": "模型目录",
    "provider": "提供商",
    "apiKey": "API Key",
    "baseUrl": "Base URL",
    "pricing": "定价",
    "inputPrice": "输入价格",
    "outputPrice": "输出价格",
    "perMillion": "/ 百万 token",
    "defaultModel": "默认模型",
    "save": "保存"
  },
  "onboarding": {
    "welcome": "欢迎使用 OpenClaw Deck",
    "step1Title": "连接网关",
    "step1Desc": "输入 Gateway URL 和认证 Token",
    "step2Title": "配置模型",
    "step2Desc": "选择 AI 模型提供商并输入 API Key",
    "step3Title": "测试对话",
    "step3Desc": "发送一条消息验证系统正常工作",
    "gatewayUrl": "Gateway URL",
    "gatewayToken": "Token",
    "testConnection": "测试连接",
    "next": "下一步",
    "back": "上一步",
    "finish": "进入控制台"
  },
  "toast": {
    "approvalRequest": "收到审批请求",
    "budgetWarning": "预算告警",
    "connectionLost": "网关连接断开",
    "connectionRestored": "网关连接恢复"
  },
  "common": {
    "save": "保存",
    "cancel": "取消",
    "confirm": "确认",
    "loading": "加载中...",
    "error": "发生错误",
    "retry": "重试"
  }
}
```

创建 `dashboard/src/i18n/en.json`（英文，结构与 zh.json 一致，值为英文）。

- [ ] **Step 2: 创建 Zustand store slices**

每个 slice < 200 LOC，使用独立文件。

**`dashboard/src/stores/gateway.ts`**（~60 LOC）：

```typescript
import { create } from "zustand";

type ConnectionStatus = "stopped" | "connecting" | "connected" | "reconnecting" | "error";

interface GatewayState {
  status: ConnectionStatus;
  statusReason: string | null;
  lastHeartbeat: string | null;
  latencyMs: number | null;
  // actions
  setStatus: (status: ConnectionStatus, reason?: string | null) => void;
  setHeartbeat: (timestamp: string, latencyMs: number) => void;
}

export const useGatewayStore = create<GatewayState>((set) => ({
  status: "stopped",
  statusReason: null,
  lastHeartbeat: null,
  latencyMs: null,
  setStatus: (status, reason = null) => set({ status, statusReason: reason }),
  setHeartbeat: (timestamp, latencyMs) => set({ lastHeartbeat: timestamp, latencyMs }),
}));
```

**`dashboard/src/stores/chat.ts`**（~100 LOC）：

```typescript
import { create } from "zustand";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolUse?: Array<{ name: string; input: unknown; output?: unknown }>;
  thinking?: string;
  isStreaming?: boolean;
  createdAt: string;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  agentId: string | null;
  isStreaming: boolean;
  // actions
  addMessage: (msg: ChatMessage) => void;
  appendDelta: (messageId: string, delta: string) => void;
  setStreaming: (streaming: boolean) => void;
  setSession: (sessionId: string | null) => void;
  setAgent: (agentId: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: null,
  agentId: null,
  isStreaming: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendDelta: (messageId, delta) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + delta } : m,
      ),
    })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setSession: (sessionId) => set({ sessionId }),
  setAgent: (agentId) => set({ agentId }),
  clearMessages: () => set({ messages: [] }),
}));
```

**`dashboard/src/stores/agents.ts`**（~50 LOC）：

```typescript
import { create } from "zustand";

interface Agent {
  id: string;
  name: string;
  model?: string;
  status: string;
}

interface AgentsState {
  agents: Agent[];
  selectedAgentId: string | null;
  setAgents: (agents: Agent[]) => void;
  selectAgent: (id: string | null) => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  selectedAgentId: null,
  setAgents: (agents) => set({ agents }),
  selectAgent: (id) => set({ selectedAgentId: id }),
}));
```

**`dashboard/src/stores/ui.ts`**（~40 LOC）：

```typescript
import { create } from "zustand";

interface UiState {
  activePanel: string;
  navExpanded: boolean;
  theme: "light" | "dark" | "system";
  locale: "zh" | "en";
  setPanel: (panel: string) => void;
  toggleNav: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLocale: (locale: "zh" | "en") => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: "chat",
  navExpanded: true,
  theme: "system",
  locale: "zh",
  setPanel: (panel) => set({ activePanel: panel }),
  toggleNav: () => set((s) => ({ navExpanded: !s.navExpanded })),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
}));
```

**`dashboard/src/stores/notifications.ts`**（~50 LOC）：

```typescript
import { create } from "zustand";

interface Toast {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
  dismissMs?: number;
}

interface NotificationsState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
```

- [ ] **Step 3: 构建 Layout Shell**

**`dashboard/src/components/layout/nav-rail.tsx`**（~150 LOC）：

NavRail 是左侧导航栏，包含 4 个分组（Core / Observe / Automate / Control），底部有 Settings。
支持 collapsed（仅图标）和 expanded（图标+文字）两种模式。

```typescript
"use client";
import { useTranslations } from "next-intl";
import { useUiStore } from "@/stores/ui";
import {
  MessageSquare,
  Bot,
  Radio,
  Cpu, // Core
  BarChart3,
  Clock,
  Brain,
  FileText,
  Activity, // Observe
  Timer,
  Webhook,
  Shield,
  Puzzle, // Automate
  Wallet,
  Bell,
  Plug,
  Settings as SettingsIcon,
  Cog,
  BookOpen, // Control
} from "lucide-react";

const NAV_GROUPS = [
  {
    labelKey: "nav.core",
    items: [
      { panel: "chat", icon: MessageSquare, labelKey: "nav.chat" },
      { panel: "agents", icon: Bot, labelKey: "nav.agents" },
      { panel: "gateway", icon: Radio, labelKey: "nav.gateway" },
      { panel: "models", icon: Cpu, labelKey: "nav.models" },
    ],
  },
  // P1/P2 groups 在此省略，P0 只渲染 Core group
];
```

**`dashboard/src/components/layout/header-bar.tsx`**（~80 LOC）：

HeaderBar 显示当前面板名称、Gateway 连接状态指示灯、语言切换（中/EN）、主题切换（日/月图标）。

**`dashboard/src/components/layout/shell.tsx`**（~50 LOC）：

Shell 组装 NavRail + HeaderBar + 主内容区。

- [ ] **Step 4: 创建 App Router 入口**

**`dashboard/src/app/layout.tsx`**：

```typescript
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Shell } from "@/components/layout/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenClaw Deck",
  description: "OpenClaw Gateway Web Dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Shell>{children}</Shell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**`dashboard/src/app/[[...panel]]/page.tsx`**：SPA catch-all 路由，根据 URL 参数渲染对应面板组件。

```typescript
"use client";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/panels/chat/chat-panel";
import { AgentsPanel } from "@/components/panels/agents/agents-panel";
import { GatewayOverviewPanel } from "@/components/panels/gateway-overview/gateway-overview-panel";
import { ModelsPanel } from "@/components/panels/models/models-panel";

const PANELS: Record<string, React.ComponentType> = {
  chat: ChatPanel,
  agents: AgentsPanel,
  gateway: GatewayOverviewPanel,
  models: ModelsPanel,
};

export default function PanelPage() {
  const params = useParams();
  const panelSlug = (params.panel as string[])?.[0] ?? "chat";
  const Panel = PANELS[panelSlug];
  if (!Panel) return <div>Panel not found</div>;
  return <Panel />;
}
```

- [ ] **Step 5: 运行测试并验证 dev server 启动**

```bash
cd dashboard && pnpm test -- src/stores/__tests__/gateway.test.ts
cd dashboard && pnpm dev
# 在浏览器访问 http://localhost:3000 确认 layout shell 渲染
```

commit：`[enhanced] feat(deck): setup i18n, Zustand stores, and layout shell with NavRail`

<!-- PARALLEL GROUP END -->

---

## Chunk 2: Core Panels (Tasks 9–12)

<!-- PARALLEL GROUP START: 4 个面板可以并行开发，它们都依赖 Chunk 1 完成 -->

### Task 9: Chat Panel + API Routes [frontend] [backend]

covers: chat-panel/spec.md > Streaming Message Display > "Incremental token rendering" + "Tool use block display" + Thinking Trace Display > "Collapsible thinking section" + File Attachment > "Drag and drop file attachment" + Session Management > "Session switching" + "New session creation" + Chat Abort > "Abort streaming response"

depends: Task 7, Task 8

**Files:**

- Create: `dashboard/src/components/panels/chat/chat-panel.tsx` (主面板 < 200 LOC)
- Create: `dashboard/src/components/panels/chat/message-list.tsx` (消息列表 < 200 LOC)
- Create: `dashboard/src/components/panels/chat/message-bubble.tsx` (单条消息 < 150 LOC)
- Create: `dashboard/src/components/panels/chat/thinking-block.tsx` (思考折叠 < 60 LOC)
- Create: `dashboard/src/components/panels/chat/tool-use-block.tsx` (工具调用 < 80 LOC)
- Create: `dashboard/src/components/panels/chat/chat-input.tsx` (输入框+文件拖拽 < 150 LOC)
- Create: `dashboard/src/components/panels/chat/session-sidebar.tsx` (对话列表 < 120 LOC)
- Create: `dashboard/src/app/api/chat/send/route.ts`
- Create: `dashboard/src/app/api/chat/abort/route.ts`
- Create: `dashboard/src/app/api/chat/history/route.ts`
- Create: `dashboard/src/lib/api-client.ts` (浏览器 fetch 封装)
- Create: `dashboard/src/lib/use-sse.ts` (SSE React hook)
- Test: `dashboard/src/components/panels/chat/__tests__/chat-panel.test.ts`
- Test: `dashboard/src/app/api/chat/__tests__/send.test.ts`

- [ ] **Step 1: 实现 api-client.ts（浏览器端 fetch 封装）**

所有浏览器→服务端请求通过此封装，自动添加 `Content-Type` 和错误处理：

```typescript
// dashboard/src/lib/api-client.ts
const BASE = "/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API Error ${status}: ${body}`);
  }
}
```

- [ ] **Step 2: 实现 use-sse.ts（SSE React hook）**

```typescript
// dashboard/src/lib/use-sse.ts
"use client";
import { useEffect, useRef } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useChatStore } from "@/stores/chat";

export function useSSE() {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    esRef.current = es;

    es.addEventListener("runtime.status", (e) => {
      const data = JSON.parse(e.data);
      useGatewayStore.getState().setStatus(data.data.status, data.data.reason);
    });

    es.addEventListener("chat.delta", (e) => {
      const data = JSON.parse(e.data);
      // 追加 streaming token 到当前消息
      useChatStore.getState().appendDelta(data.data.messageId, data.data.delta);
    });

    es.onerror = () => {
      // EventSource 自动重连，无需额外处理
    };

    return () => es.close();
  }, []);
}
```

- [ ] **Step 3: 实现 Chat API routes**

**`dashboard/src/app/api/chat/send/route.ts`**（< 100 LOC）：

```typescript
import { NextResponse } from "next/server";
import { getRuntime } from "@server/runtime";

export async function POST(request: Request) {
  const { message, sessionId, agentId, files } = await request.json();
  const { gateway } = getRuntime();

  // 转发到 Gateway RPC
  const result = await gateway.request("chat.send", {
    message,
    sessionId,
    agentId,
    files,
  });

  return NextResponse.json(result);
}
```

**`dashboard/src/app/api/chat/abort/route.ts`**：

```typescript
export async function POST(request: Request) {
  const { sessionId } = await request.json();
  const { gateway } = getRuntime();
  const result = await gateway.request("chat.abort", { sessionId });
  return NextResponse.json(result);
}
```

**`dashboard/src/app/api/chat/history/route.ts`**：

```typescript
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const { gateway } = getRuntime();
  const result = await gateway.request("chat.history", { sessionId });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: 实现 Chat 面板组件**

**chat-panel.tsx**（< 200 LOC）— 主面板，组装 sidebar + message-list + input：

```typescript
"use client";
import { SessionSidebar } from "./session-sidebar";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

export function ChatPanel() {
  return (
    <div className="flex h-full">
      <SessionSidebar />
      <div className="flex flex-1 flex-col">
        <MessageList />
        <ChatInput />
      </div>
    </div>
  );
}
```

**message-bubble.tsx**（< 150 LOC）— 单条消息，含 Markdown 渲染、tool_use block、thinking trace：

- 使用 `react-markdown` + `remark-gfm` 渲染 Markdown
- `tool_use` block：用 `<ToolUseBlock>` 子组件渲染
- thinking trace：用 `<ThinkingBlock>` 子组件渲染（折叠状态）

**thinking-block.tsx**（< 60 LOC）— 可折叠的"思考中"区块：

```typescript
"use client";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

export function ThinkingBlock({ content }: { content: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
        思考过程
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 rounded bg-muted p-3 text-xs">{content}</pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**tool-use-block.tsx**（< 80 LOC）— 工具调用展示块

**chat-input.tsx**（< 150 LOC）— 输入框 + 文件拖拽 + 发送/停止按钮：

- 监听 `onDragOver`/`onDrop` 实现文件拖拽
- 发送按钮 → `apiPost("/chat/send", ...)`
- 停止按钮（streaming 中显示）→ `apiPost("/chat/abort", ...)`
- `Ctrl+Enter` 发送快捷键

**session-sidebar.tsx**（< 120 LOC）— 对话列表侧边栏：

- 列出所有 session（`apiGet("/chat/history?list=true")`）
- 点击切换 session
- "新对话"按钮

- [ ] **Step 5: 编写 Chat 面板测试**

测试用例：

1. 消息列表正确渲染 user/assistant 消息
2. streaming delta 正确追加到消息内容
3. thinking block 默认折叠
4. tool_use block 正确显示工具名和参数
5. 发送消息调用正确的 API
6. abort 按钮在 streaming 时显示

- [ ] **Step 6: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- src/components/panels/chat
cd dashboard && pnpm test -- src/app/api/chat
```

commit：`[enhanced] feat(deck): implement Chat panel with streaming, tool_use, thinking trace`

---

### Task 10: Agents Panel + API Routes [frontend] [backend]

covers: agent-management/spec.md > Agent Fleet CRUD > "List all agents" + "Create a new agent" + "Delete an agent" + Per-Agent Configuration > "Edit agent model assignment" + "Edit SOUL.md" + Agent File Management > "Browse agent files"

depends: Task 7, Task 8

**Files:**

- Create: `dashboard/src/components/panels/agents/agents-panel.tsx` (< 200 LOC)
- Create: `dashboard/src/components/panels/agents/agent-list.tsx` (< 150 LOC)
- Create: `dashboard/src/components/panels/agents/agent-config.tsx` (< 200 LOC)
- Create: `dashboard/src/components/panels/agents/soul-editor.tsx` (< 100 LOC)
- Create: `dashboard/src/components/panels/agents/agent-files.tsx` (< 100 LOC)
- Create: `dashboard/src/app/api/agents/route.ts` (list + create)
- Create: `dashboard/src/app/api/agents/[agentId]/route.ts` (update + delete)
- Create: `dashboard/src/app/api/agents/[agentId]/files/route.ts` (files.list + get + set)
- Test: `dashboard/src/components/panels/agents/__tests__/agents-panel.test.ts`
- Test: `dashboard/src/app/api/agents/__tests__/route.test.ts`

- [ ] **Step 1: 编写 Agents API 测试**

测试用例：

1. `GET /api/agents` → 调用 `gateway.request("agents.list")` 返回 agent 列表
2. `POST /api/agents` → 调用 `gateway.request("agents.create")` 创建 agent
3. `PATCH /api/agents/[id]` → 调用 `gateway.request("agents.update")` 更新 agent
4. `DELETE /api/agents/[id]` → 调用 `gateway.request("agents.delete")` 删除 agent
5. `GET /api/agents/[id]/files` → 调用 `gateway.request("agents.files.list")`
6. `GET /api/agents/[id]/files?path=SOUL.md` → 调用 `gateway.request("agents.files.get")`
7. `PUT /api/agents/[id]/files` → 调用 `gateway.request("agents.files.set")`

- [ ] **Step 2: 实现 Agents API routes**

**`dashboard/src/app/api/agents/route.ts`**（< 80 LOC）：

```typescript
import { NextResponse } from "next/server";
import { getRuntime } from "@server/runtime";

// 读取可选 platform headers
function extractPlatformHeaders(req: Request) {
  return {
    tenantId: req.headers.get("X-Tenant-Id"),
    userId: req.headers.get("X-User-Id"),
  };
}

export async function GET(request: Request) {
  const { gateway } = getRuntime();
  const agents = await gateway.request("agents.list", {});
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { gateway } = getRuntime();
  const result = await gateway.request("agents.create", body);
  return NextResponse.json(result);
}
```

**`dashboard/src/app/api/agents/[agentId]/route.ts`**、**`[agentId]/files/route.ts`** 类似模式。

- [ ] **Step 3: 实现 Agents 面板组件**

**agents-panel.tsx**（< 200 LOC）— 左侧 agent 列表 + 右侧配置面板：

```typescript
"use client";
export function AgentsPanel() {
  return (
    <div className="flex h-full">
      <AgentList />
      <AgentConfig />
    </div>
  );
}
```

**agent-list.tsx**（< 150 LOC）— agent 列表 + 状态指示器 + 创建/删除：

- 每个 agent 显示名称、模型、状态 badge
- 顶部"创建智能体"按钮 → Dialog 表单
- 右键菜单或删除图标 → 确认 Dialog → 调用 DELETE API

**agent-config.tsx**（< 200 LOC）— 选中 agent 的配置面板：

- 模型选择下拉框（从 `models.list` 获取可用模型）
- SOUL.md 编辑器入口
- 工作区设置

**soul-editor.tsx**（< 100 LOC）— SOUL.md 文本编辑器：

- 从 `agents.files.get` 加载内容
- 保存 → `agents.files.set`
- 使用 shadcn/ui `Textarea`，支持 Markdown 预览

**agent-files.tsx**（< 100 LOC）— agent 工作区文件浏览：

- 从 `agents.files.list` 加载文件树
- 点击文件 → `agents.files.get` 查看内容

- [ ] **Step 4: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- src/components/panels/agents src/app/api/agents
```

commit：`[enhanced] feat(deck): implement Agents panel with CRUD, SOUL.md editor, file browser`

---

### Task 11: Gateway Overview Panel + API Routes [frontend] [backend]

covers: gateway-overview/spec.md > Connection Status Display > "Connected state display" + "Error state display" + Health Monitoring > "Health card rendering" + Heartbeat Monitor > "Heartbeat display" + Gateway State Display > "Display active state" + "Display paused state" + Control Channel Diagnostics > "Diagnostics display"

depends: Task 7, Task 8

**Files:**

- Create: `dashboard/src/components/panels/gateway-overview/gateway-overview-panel.tsx` (< 150 LOC)
- Create: `dashboard/src/components/panels/gateway-overview/connection-status-card.tsx` (< 80 LOC)
- Create: `dashboard/src/components/panels/gateway-overview/health-card.tsx` (< 100 LOC)
- Create: `dashboard/src/components/panels/gateway-overview/heartbeat-monitor.tsx` (< 80 LOC)
- Create: `dashboard/src/components/panels/gateway-overview/diagnostics-card.tsx` (< 100 LOC)
- Create: `dashboard/src/app/api/gateway/status/route.ts`
- Create: `dashboard/src/app/api/gateway/health/route.ts`
- Test: `dashboard/src/components/panels/gateway-overview/__tests__/gateway-overview-panel.test.ts`
- Test: `dashboard/src/app/api/gateway/__tests__/status.test.ts`

- [ ] **Step 1: 编写 Gateway API 测试**

测试用例：

1. `GET /api/gateway/status` → 返回 adapter 的 connection status + reason
2. `GET /api/gateway/health` → 调用 `gateway.request("health")` 返回健康状态
3. 连接状态从 Zustand store 实时更新（通过 SSE）

- [ ] **Step 2: 实现 Gateway API routes**

**`dashboard/src/app/api/gateway/status/route.ts`**：

```typescript
import { NextResponse } from "next/server";
import { getRuntime } from "@server/runtime";

export async function GET() {
  const { gateway } = getRuntime();
  return NextResponse.json({
    status: gateway.getStatus(),
    reason: gateway.getStatusReason(),
  });
}
```

**`dashboard/src/app/api/gateway/health/route.ts`**：

```typescript
export async function GET() {
  const { gateway } = getRuntime();
  // health RPC 返回 link status, auth age, session stats
  const health = await gateway.request("health", {});
  // status RPC 返回 active sessions, channels, heartbeat
  const status = await gateway.request("status", {});
  // config.get 获取 Gateway 运行状态（active/paused）
  const config = await gateway.request("config.get", {});

  return NextResponse.json({ health, status, config });
}
```

- [ ] **Step 3: 实现 Gateway Overview 面板组件**

**gateway-overview-panel.tsx**（< 150 LOC）— 网格布局，4 张卡片：

```typescript
"use client";
export function GatewayOverviewPanel() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ConnectionStatusCard />
      <HealthCard />
      <HeartbeatMonitor />
      <DiagnosticsCard />
    </div>
  );
}
```

**connection-status-card.tsx**（< 80 LOC）：

- 从 `useGatewayStore` 读取实时状态
- 绿色圆点 = connected，黄色 = reconnecting，红色 = error，灰色 = stopped
- 显示 Gateway URL

**health-card.tsx**（< 100 LOC）：

- 调用 `/api/gateway/health` 获取数据
- 显示 link status、auth age、session count

**heartbeat-monitor.tsx**（< 80 LOC）：

- 从 `useGatewayStore` 读取 lastHeartbeat 和 latencyMs
- 显示最近心跳时间和 RTT 延迟

**diagnostics-card.tsx**（< 100 LOC）：

- StatusSummary：active sessions、connected channels、last heartbeat
- Deck Server 自测 WS roundtrip 延迟（通过 `/api/gateway/health` 获取）

- [ ] **Step 4: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- src/components/panels/gateway-overview src/app/api/gateway
```

commit：`[enhanced] feat(deck): implement Gateway Overview panel with health, heartbeat, diagnostics`

---

### Task 12: Models Panel + API Routes [frontend] [backend]

covers: model-management/spec.md > Model Catalog Display > "List models by provider" + Provider Configuration > "Set provider API key" + "Configure custom base URL" + Model Cost Display > "Display model pricing" + Default Model Selection > "Set default model for agent"

depends: Task 7, Task 8

**Files:**

- Create: `dashboard/src/components/panels/models/models-panel.tsx` (< 150 LOC)
- Create: `dashboard/src/components/panels/models/model-catalog.tsx` (< 200 LOC)
- Create: `dashboard/src/components/panels/models/provider-config.tsx` (< 200 LOC)
- Create: `dashboard/src/app/api/models/route.ts` (list)
- Create: `dashboard/src/app/api/models/config/route.ts` (provider config get/set)
- Test: `dashboard/src/components/panels/models/__tests__/models-panel.test.ts`
- Test: `dashboard/src/app/api/models/__tests__/route.test.ts`

- [ ] **Step 1: 编写 Models API 测试**

测试用例：

1. `GET /api/models` → 调用 `gateway.request("models.list")` 返回模型列表
2. `PATCH /api/models/config` → 调用 `gateway.request("config.patch")` 更新 provider 配置
3. 模型按 provider 分组

- [ ] **Step 2: 实现 Models API routes**

**`dashboard/src/app/api/models/route.ts`**：

```typescript
export async function GET() {
  const { gateway } = getRuntime();
  const models = await gateway.request("models.list", {});
  return NextResponse.json(models);
}
```

**`dashboard/src/app/api/models/config/route.ts`**：

```typescript
export async function GET() {
  const { gateway } = getRuntime();
  const config = await gateway.request("config.get", {});
  // 提取 model 相关配置
  return NextResponse.json(config);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { gateway } = getRuntime();
  const result = await gateway.request("config.patch", body);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: 实现 Models 面板组件**

**models-panel.tsx**（< 150 LOC）— 左侧 provider 列表 + 右侧配置/目录：

```typescript
"use client";
export function ModelsPanel() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  return (
    <div className="flex h-full gap-4">
      <div className="w-64 shrink-0">
        <ModelCatalog onSelectProvider={setSelectedProvider} />
      </div>
      <div className="flex-1">
        {selectedProvider && <ProviderConfig provider={selectedProvider} />}
      </div>
    </div>
  );
}
```

**model-catalog.tsx**（< 200 LOC）：

- 调用 `/api/models` 获取模型列表
- 按 provider（OpenAI / Anthropic / Google / ...）分组显示
- 每个模型显示：名称、context window、input price / output price（per 1M tokens）
- 使用 `Accordion` 或 `Collapsible` 展开/折叠 provider

**provider-config.tsx**（< 200 LOC）：

- API Key 输入（密码类型，支持显示/隐藏）
- Base URL 输入（可选，自定义 endpoint）
- 默认模型选择下拉框
- 保存按钮 → `PATCH /api/models/config`

- [ ] **Step 4: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- src/components/panels/models src/app/api/models
```

commit：`[enhanced] feat(deck): implement Models panel with provider config and pricing display`

<!-- PARALLEL GROUP END -->

---

## Chunk 3: Global Features (Tasks 13–15)

### Task 13: Onboarding Wizard [frontend]

covers: onboarding-wizard/spec.md > First-Run Detection > "Auto-launch on unconfigured state" + "Skip when already configured" + Step 1 > "Configure Gateway connection" + "Connection failure feedback" + Step 2 > "Configure provider" + Step 3 > "Successful test chat" + "Test chat failure"

depends: Task 7, Task 9

**Files:**

- Create: `dashboard/src/components/onboarding/onboarding-wizard.tsx` (< 200 LOC)
- Create: `dashboard/src/components/onboarding/step-gateway.tsx` (< 150 LOC)
- Create: `dashboard/src/components/onboarding/step-provider.tsx` (< 150 LOC)
- Create: `dashboard/src/components/onboarding/step-test-chat.tsx` (< 150 LOC)
- Create: `dashboard/src/app/api/settings/route.ts` (读取/写入 deck settings)
- Create: `dashboard/src/app/api/settings/check/route.ts` (检测是否已配置)
- Modify: `dashboard/src/app/[[...panel]]/page.tsx` (添加 onboarding 检测)
- Test: `dashboard/src/components/onboarding/__tests__/onboarding-wizard.test.ts`

- [ ] **Step 1: 编写 Settings API 和 Onboarding 测试**

测试用例：

1. `GET /api/settings/check` → 未配置时返回 `{ configured: false }`
2. `GET /api/settings/check` → 已配置时返回 `{ configured: true }`
3. `POST /api/settings` → 写入 gateway_url 和 gateway_token 到 settings 表
4. Wizard Step 1 连接成功 → 绿色 checkmark，Next 按钮可点击
5. Wizard Step 1 连接失败 → 显示错误消息，Next 按钮禁用
6. Wizard Step 3 测试发送成功 → 显示 "进入控制台" 按钮

- [ ] **Step 2: 实现 Settings API routes**

**`dashboard/src/app/api/settings/route.ts`**：

```typescript
export async function GET() {
  const { db } = getRuntime();
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const settings = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { db } = getRuntime();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
  );
  for (const [key, value] of Object.entries(body)) {
    upsert.run(key, String(value), String(value));
  }
  return NextResponse.json({ ok: true });
}
```

**`dashboard/src/app/api/settings/check/route.ts`**：

```typescript
export async function GET() {
  const { db, gateway } = getRuntime();
  const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'gateway_url'").get();
  const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'gateway_token'").get();
  const configured = Boolean(
    (urlRow as any)?.value && (tokenRow as any)?.value && gateway.getStatus() === "connected",
  );
  return NextResponse.json({ configured });
}
```

- [ ] **Step 3: 实现 Onboarding Wizard 组件**

**onboarding-wizard.tsx**（< 200 LOC）— 步骤容器 + 进度指示：

```typescript
"use client";
import { useState } from "react";
import { StepGateway } from "./step-gateway";
import { StepProvider } from "./step-provider";
import { StepTestChat } from "./step-test-chat";

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);

  return (
    <div className="mx-auto max-w-lg py-12">
      {/* 步骤进度条 */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-2 flex-1 rounded ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && <StepGateway onNext={() => setStep(2)} />}
      {step === 2 && <StepProvider onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepTestChat onComplete={onComplete} onBack={() => setStep(2)} />}
    </div>
  );
}
```

**step-gateway.tsx**（< 150 LOC）— Gateway URL + Token 输入 + 连接测试：

- URL 输入框（默认值 `ws://localhost:18789`）
- Token 输入框（密码类型）
- "测试连接"按钮 → `POST /api/settings` 保存 → 检查 gateway status
- 成功 → 绿色 checkmark + "下一步"可用
- 失败 → 红色错误消息 + "下一步"禁用

**step-provider.tsx**（< 150 LOC）— Provider + Model + API Key：

- Provider 下拉选择（OpenAI / Anthropic / Google / ...）
- API Key 输入
- Model 下拉选择
- 保存 → `PATCH /api/models/config`

**step-test-chat.tsx**（< 150 LOC）— 发送测试消息：

- 预置测试消息："你好，请简单介绍一下自己。"
- 发送按钮 → `POST /api/chat/send`
- 显示 streaming 响应
- 成功 → "进入控制台"按钮
- 失败 → 错误消息 + "上一步"按钮

- [ ] **Step 4: 修改 SPA 入口集成 Onboarding 检测**

修改 `dashboard/src/app/[[...panel]]/page.tsx`，在页面加载时检查 `/api/settings/check`，如果未配置则显示 Onboarding Wizard 而不是面板。

- [ ] **Step 5: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- src/components/onboarding src/app/api/settings
```

commit：`[enhanced] feat(deck): implement Onboarding Wizard with 3-step setup flow`

---

### Task 14: Toast Notification System [frontend]

covers: tasks.md > 3.5 > "global provider, toast types, auto-dismiss" + 3.6 > "approval request and budget alert notifications via EventBus subscription"

depends: Task 4, Task 8

**Files:**

- Create: `dashboard/src/components/notifications/toast-provider.tsx` (< 100 LOC)
- Create: `dashboard/src/components/notifications/toast-item.tsx` (< 80 LOC)
- Modify: `dashboard/src/app/layout.tsx` (添加 ToastProvider)
- Modify: `dashboard/src/lib/use-sse.ts` (添加 notification event handler)
- Test: `dashboard/src/components/notifications/__tests__/toast-provider.test.ts`

- [ ] **Step 1: 编写 Toast 测试**

测试用例：

1. `addToast` → toast 出现在列表中
2. auto-dismiss → 指定时间后 toast 自动消失
3. `dismissToast` → 手动关闭 toast
4. 不同 type（info/success/warning/error）渲染不同样式
5. EventBus approval.requested 事件 → 自动弹出 toast

- [ ] **Step 2: 实现 Toast 组件**

**toast-provider.tsx**（< 100 LOC）：

```typescript
"use client";
import { useEffect } from "react";
import { useNotificationsStore } from "@/stores/notifications";
import { ToastItem } from "./toast-item";

export function ToastProvider() {
  const { toasts, dismissToast } = useNotificationsStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}
```

**toast-item.tsx**（< 80 LOC）：

```typescript
"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

const STYLE_MAP = {
  info: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  success: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
  warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
  error: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
};

export function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const ms = toast.dismissMs ?? 5000;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [toast.dismissMs, onDismiss]);

  return (
    <div className={`rounded-lg border p-4 shadow-lg ${STYLE_MAP[toast.type]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{toast.title}</p>
          {toast.description && <p className="text-sm text-muted-foreground">{toast.description}</p>}
        </div>
        <button onClick={onDismiss}><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 集成 SSE 事件驱动 Toast**

在 `use-sse.ts` 中添加事件监听：

```typescript
// approval 请求 → 弹 toast
es.addEventListener("gateway.event", (e) => {
  const data = JSON.parse(e.data);
  if (data.data?.event === "exec.approval.requested") {
    useNotificationsStore.getState().addToast({
      type: "warning",
      title: t("toast.approvalRequest"),
      description: data.data.payload?.tool ?? "",
      dismissMs: 0, // 不自动消失，需要用户处理
    });
  }
});

// 连接断开/恢复 → 弹 toast
es.addEventListener("runtime.status", (e) => {
  const data = JSON.parse(e.data);
  const status = data.data?.status;
  if (status === "error" || status === "reconnecting") {
    useNotificationsStore.getState().addToast({
      type: "error",
      title: t("toast.connectionLost"),
    });
  } else if (status === "connected") {
    useNotificationsStore.getState().addToast({
      type: "success",
      title: t("toast.connectionRestored"),
    });
  }
});
```

- [ ] **Step 4: 修改 layout.tsx 添加 ToastProvider**

在 `<Shell>` 内部添加 `<ToastProvider />`。

- [ ] **Step 5: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- src/components/notifications
```

commit：`[enhanced] feat(deck): implement Toast notification system with EventBus integration`

---

### Task 15: Platform Contract Headers [backend]

covers: tasks.md > 1.16 > "all API routes SHALL accept and transparently pass through optional X-Tenant-Id / X-User-Id headers"

depends: Task 7

**Files:**

- Create: `dashboard/src/lib/platform-headers.ts`
- Modify: `dashboard/src/app/api/chat/send/route.ts` (示范集成)
- Modify: `dashboard/src/app/api/agents/route.ts` (示范集成)
- Test: `dashboard/src/lib/__tests__/platform-headers.test.ts`

- [ ] **Step 1: 编写 platform-headers 测试**

测试用例：

1. 请求包含 `X-Tenant-Id` → 正确提取
2. 请求包含 `X-User-Id` → 正确提取
3. 请求无 platform headers → 返回 null
4. `withPlatformContext` 将 headers 注入到 lib 函数调用中

- [ ] **Step 2: 实现 platform-headers.ts**

```typescript
// dashboard/src/lib/platform-headers.ts
// claw-platform 反向代理集成：
// 所有 API route 透传 X-Tenant-Id / X-User-Id 到业务逻辑层

export interface PlatformContext {
  tenantId: string | null;
  userId: string | null;
}

export function extractPlatformContext(request: Request): PlatformContext {
  return {
    tenantId: request.headers.get("X-Tenant-Id"),
    userId: request.headers.get("X-User-Id"),
  };
}

/**
 * 将 platform context 附加到 Gateway RPC params 中
 * claw-platform 可在其 middleware 层填充这些 headers
 */
export function withPlatformContext<T extends Record<string, unknown>>(
  params: T,
  ctx: PlatformContext,
): T & { _platform?: PlatformContext } {
  if (!ctx.tenantId && !ctx.userId) return params;
  return { ...params, _platform: ctx };
}
```

- [ ] **Step 3: 在所有已实现的 API route 中集成**

修改每个 API route handler，添加：

```typescript
const ctx = extractPlatformContext(request);
// 传入 gateway.request 时附带 ctx（可选）
```

这是一个轻量改动，每个 route 只需添加 2 行代码。

- [ ] **Step 4: 运行测试并 commit**

```bash
cd dashboard && pnpm test -- src/lib/__tests__/platform-headers.test.ts
```

commit：`[enhanced] feat(deck): implement platform contract headers for claw-platform integration`

---

## Dependency Graph Summary

```
Task 1 (scaffold)
  └─→ Task 2 (deps)
        ├─→ Task 3 (WS adapter) ──┐
        ├─→ Task 6 (access gate)  │
        └─→ Task 8 (i18n+layout)  │
              │                    │
Task 3 ──→ Task 4 (EventBus+SSE)  │
Task 4 ──→ Task 5 (SQLite+store)  │
              │                    │
Task 3+4+5+6 ─→ Task 7 (runtime)  │
              │                    │
Task 7+8 ─────┼─→ Task 9  (Chat)  │
              ├─→ Task 10 (Agents) │  ← PARALLEL
              ├─→ Task 11 (Gateway)│
              └─→ Task 12 (Models) │
                                   │
Task 7+9 ──→ Task 13 (Onboarding) │
Task 4+8 ──→ Task 14 (Toast)      │
Task 7 ────→ Task 15 (Headers)    │
```

## Exit Criteria

P0 完成的验收标准：

- [ ] `pnpm build` 在 `dashboard/` 目录下通过
- [ ] `pnpm test` 所有测试通过
- [ ] Gateway 连接建立，状态实时显示在 UI
- [ ] Chat 面板可发送消息、接收 streaming 响应、显示 tool_use 和 thinking trace
- [ ] Agents 面板可列出/创建/删除 agent，编辑 SOUL.md
- [ ] Models 面板可列出模型、配置 provider API key
- [ ] Gateway Overview 面板显示连接状态、健康信息、心跳延迟
- [ ] Onboarding Wizard 首次运行自动触发，3 步完成配置
- [ ] Toast 通知系统工作（连接状态变更、审批请求）
- [ ] 所有 API route 支持 `X-Tenant-Id` / `X-User-Id` 透传
- [ ] 中/英文切换正常
- [ ] Dark/Light 主题切换正常
