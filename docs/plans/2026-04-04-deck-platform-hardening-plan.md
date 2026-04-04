# Deck Platform Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 4 platform gaps blocking upstream iteration: upstream result schemas, unified error model, panel registry, coverage gate automation.

**Architecture:** 4 independent capabilities with minimal cross-dependency. Tasks 1-3 (schemas) use separate method-defs files following repo convention. Task 4 migrates API routes. Tasks 5-7 (errors) are client-side only. Tasks 8-9 (registry) refactor 5 touch points into one. Task 10 (coverage script) imports method-registry-data directly. Task 11 (dead route cleanup) removes nonexistent tools.effective. Task 12 updates matrix.

**Tech Stack:** TypeBox (schema), TypeScript, Next.js, Zustand, Vitest

**OpenSpec:** `openspec/changes/deck-platform-hardening/`

**Parallel groups:** Task 1 → Task 2 (sequential, shared file) | Task 3, Task 5, Task 8, Task 10, Task 11 (parallelizable) | Task 4 (blocked by 1-3) | Task 6-7 (blocked by 5) | Task 9 (blocked by 8) | Task 12 (blocked by all)

---

### Task 1: Result Schema — sessions.usage (+ usage-method-defs.ts)

**Files:**

- Create: `src/gateway/server-methods/usage-method-defs.ts`
- Create: `src/gateway/protocol/schema/usage-result-schemas.ts`
- Modify: `src/gateway/method-registry-data.ts`

**实施描述:** 创建独立的 `usage-method-defs.ts`（遵循 `chat-method-defs.ts` / `sessions-method-defs.ts` 模式），为 `sessions.usage` 添加 result schema。
**验收标准:** `pnpm protocol:gen:ts` 后 `sessions.usage` 出现在 GatewayMethodMap。
**测试要求:** `pnpm protocol:gen:check` 通过。
**依赖关系:** 无
**域标签:** `[backend]`
**复杂度:** `complex`

- [ ] **Step 1:** 读取 `src/gateway/server-methods/usage.ts:368-809`，确认 `sessions.usage` 的 respond 返回结构
- [ ] **Step 2:** 参考 `src/gateway/server-methods/chat-method-defs.ts` 的模式，创建 `src/gateway/protocol/schema/usage-result-schemas.ts`，定义 `SessionsUsageResultSchema`（TypeBox `Type.Object`）
- [ ] **Step 3:** 创建 `src/gateway/server-methods/usage-method-defs.ts`（独立于 handler 文件），导出 `usageMethodDefs`，为 `sessions.usage` 注册 `params` + `result` + `scope`
- [ ] **Step 4:** 在 `src/gateway/method-registry-data.ts` 中 `import { usageMethodDefs }` 并 spread 到 `allMethodDefs`
- [ ] **Step 5:** 运行 `pnpm protocol:gen:ts` 验证 `sessions.usage` 出现在 GatewayMethodMap
- [ ] **Step 6:** Commit: `scripts/committer "[enhanced][codex-impl] feat(gateway): add sessions.usage result schema + usage-method-defs" src/gateway/server-methods/usage-method-defs.ts src/gateway/protocol/schema/usage-result-schemas.ts src/gateway/method-registry-data.ts dashboard/src/types/gateway-protocol.generated.ts dashboard/src/types/gateway-client.generated.ts`

### Task 2: Result Schemas — sessions.usage.logs + sessions.usage.timeseries

**Files:**

- Modify: `src/gateway/protocol/schema/usage-result-schemas.ts`
- Modify: `src/gateway/server-methods/usage-method-defs.ts`

**实施描述:** 在已有的 usage-method-defs 中追加 `sessions.usage.logs` 和 `sessions.usage.timeseries` 的 result schemas。
**验收标准:** 两个方法都出现在 GatewayMethodMap 中。
**测试要求:** `pnpm protocol:gen:check` 通过。
**依赖关系:** blockedBy Task 1（共享 usageMethodDefs）
**域标签:** `[backend]`
**复杂度:** `simple`

- [ ] **Step 1:** 读取 `sessions.usage.logs` handler（usage.ts:847-876），确认返回 `{ logs: SessionLogEntry[] }`
- [ ] **Step 2:** 在 usage-result-schemas.ts 中定义 `SessionsUsageLogsResultSchema`
- [ ] **Step 3:** 读取 `sessions.usage.timeseries` handler（usage.ts:810-846），确认返回结构和 **实际接受的参数**（注意：dashboard route 传 `{ days }` 但 handler 可能期望不同参数，需要确认 handler 的 params 解析逻辑）
- [ ] **Step 4:** 在 usage-result-schemas.ts 中定义 `SessionsUsageTimeseriesResultSchema`
- [ ] **Step 5:** 在 `usageMethodDefs` 中注册两个方法
- [ ] **Step 6:** 运行 `pnpm protocol:gen:ts` + `pnpm protocol:gen:check`
- [ ] **Step 7:** Commit

### Task 3: Result Schema — skills.install (+ skills-method-defs.ts)

**Files:**

- Create: `src/gateway/server-methods/skills-method-defs.ts`
- Modify: `src/gateway/protocol/schema/` (skills result schema)
- Modify: `src/gateway/method-registry-data.ts`

**实施描述:** 创建独立的 `skills-method-defs.ts`，为 `skills.install` 添加 result schema。Handler 有两条返回路径（clawhub 和常规），schema 取并集。
**验收标准:** `skills.install` 出现在 GatewayMethodMap。
**测试要求:** `pnpm protocol:gen:check` 通过。
**依赖关系:** 无（可与 Task 1 并行）
**域标签:** `[backend]`
**复杂度:** `simple`

- [ ] **Step 1:** 读取 `skills.install` handler（skills.ts:121-189），确认两条路径返回值的并集字段
- [ ] **Step 2:** 定义 `SkillsInstallResultSchema` — 取并集：`{ ok, message, stdout, stderr, code, slug?, version?, targetDir?, warnings? }`
- [ ] **Step 3:** 创建 `src/gateway/server-methods/skills-method-defs.ts`，导出 `skillsMethodDefs`
- [ ] **Step 4:** 在 `method-registry-data.ts` 中接入 `skillsMethodDefs`
- [ ] **Step 5:** 运行 `pnpm protocol:gen:ts` + `pnpm protocol:gen:check`
- [ ] **Step 6:** Commit

### Task 4: Migrate Dashboard API Routes to typed gwRequest

**Files:**

- Modify: `dashboard/src/app/api/usage/sessions/route.ts`
- Modify: `dashboard/src/app/api/usage/sessions/logs/route.ts`
- Modify: `dashboard/src/app/api/usage/timeseries/route.ts`
- Modify: `dashboard/src/app/api/skills/install/route.ts`

**实施描述:** 将 4 个 API routes 从 `gatewayRequest()` 迁移到 typed `gwRequest()`。对 `usage/timeseries/route.ts` 需要额外确认参数契约（dashboard 传 `{ days }` 需与 handler 实际接受的 params 对齐）。
**验收标准:** 4 个文件中不再有 `gatewayRequest` 调用。`pnpm check` + `pnpm build` 通过。
**测试要求:** `pnpm check` + `pnpm build`。
**依赖关系:** blockedBy Task 1, 2, 3
**域标签:** `[frontend]`
**复杂度:** `simple`

- [ ] **Step 1:** 在每个 route 中：将 `import { gatewayRequest }` 改为 `import { gwRequest }`，将 `gatewayRequest("method", params)` 改为 `gwRequest("method", params)`
- [ ] **Step 2:** 对 `usage/timeseries/route.ts` 特别检查：typed params 与 route 传入的 `{ days }` 是否匹配。如果 TypeBox params schema 的字段名不同，需要在 route 中做映射
- [ ] **Step 3:** 运行 `pnpm check` + `pnpm build` 验证
- [ ] **Step 4:** Commit: `scripts/committer "[enhanced][codex-impl] refactor(deck): migrate 4 API routes to typed gwRequest" dashboard/src/app/api/usage/sessions/route.ts dashboard/src/app/api/usage/sessions/logs/route.ts dashboard/src/app/api/usage/timeseries/route.ts dashboard/src/app/api/skills/install/route.ts`

### Task 5: Unified Error Model — errors.ts

**Files:**

- Create: `dashboard/src/lib/errors.ts`
- Test: `dashboard/src/lib/__tests__/errors.test.ts`

**实施描述:** 创建统一错误模型：GatewayErrorCode 枚举、DeckApiError class、ErrorBody 类型、fetchApi helper。注意：`mapGatewayError` 因依赖 server-side `ControlPlaneGatewayError` 类型，放在 `api-helpers.ts` 中（Task 6 处理）。
**验收标准:** errors.ts 导出所有公共 API。test 全部通过。
**测试要求:** 单元测试覆盖 fetchApi 的 6 种场景（200 成功、502 Gateway error、401 Unauthorized、429 Rate Limited、503 Not Configured、网络失败）。
**依赖关系:** 无
**域标签:** `[frontend]`
**复杂度:** `complex`

- [ ] **Step 1:** 创建 `dashboard/src/lib/__tests__/errors.test.ts`，编写 fetchApi 测试（6 种场景）：

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("fetchApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ skills: [] }) }),
    );
    const { fetchApi } = await import("@/lib/errors");
    const result = await fetchApi<{ skills: unknown[] }>("/api/skills");
    expect(result).toEqual({ skills: [] });
  });

  it("throws DeckApiError with GATEWAY_ERROR on 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: "timeout", code: "GATEWAY_ERROR" }),
      }),
    );
    const { fetchApi, DeckApiError } = await import("@/lib/errors");
    await expect(fetchApi("/api/x")).rejects.toThrow(DeckApiError);
  });

  it("throws DeckApiError with UNAUTHORIZED on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      }),
    );
    const { fetchApi, DeckApiError, GatewayErrorCode } = await import("@/lib/errors");
    try {
      await fetchApi("/api/x");
    } catch (e) {
      expect((e as InstanceType<typeof DeckApiError>).code).toBe(GatewayErrorCode.UNAUTHORIZED);
    }
  });

  it("throws DeckApiError with RATE_LIMITED on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: "Too many requests" }),
      }),
    );
    const { fetchApi, DeckApiError, GatewayErrorCode } = await import("@/lib/errors");
    try {
      await fetchApi("/api/x");
    } catch (e) {
      expect((e as InstanceType<typeof DeckApiError>).code).toBe(GatewayErrorCode.RATE_LIMITED);
    }
  });

  it("throws DeckApiError with NOT_CONFIGURED on 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: "Gateway not configured" }),
      }),
    );
    const { fetchApi, DeckApiError, GatewayErrorCode } = await import("@/lib/errors");
    try {
      await fetchApi("/api/x");
    } catch (e) {
      expect((e as InstanceType<typeof DeckApiError>).code).toBe(GatewayErrorCode.NOT_CONFIGURED);
    }
  });

  it("throws DeckApiError with INTERNAL on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { fetchApi, DeckApiError } = await import("@/lib/errors");
    await expect(fetchApi("/api/x")).rejects.toThrow(DeckApiError);
  });
});
```

- [ ] **Step 2:** 运行测试确认失败：`cd dashboard && pnpm test -- src/lib/__tests__/errors.test.ts`
- [ ] **Step 3:** 创建 `dashboard/src/lib/errors.ts`（参见上一版 plan 中的完整实现，包含 `GatewayErrorCode` 6 值枚举、`DeckApiError` class、`statusToCode` 函数、`fetchApi<T>` helper）
- [ ] **Step 4:** 运行测试确认通过 + `pnpm check`
- [ ] **Step 5:** Commit

### Task 6: Consolidate ErrorBody + add mapGatewayError

**Files:**

- Modify: `dashboard/src/lib/api-helpers.ts`
- Modify: `dashboard/src/lib/with-auth.ts`
- Modify: `dashboard/src/components/panels/chat/chat-api.ts`

**实施描述:** 合并 3 处 ErrorBody 定义到 errors.ts 导入。在 `api-helpers.ts` 中添加 `mapGatewayError`（因依赖 server-side `ControlPlaneGatewayError`，放在此处而非 errors.ts）。
**验收标准:** 无重复 ErrorBody 定义。gwRequest 的 catch 块使用 mapGatewayError。
**测试要求:** `pnpm check` + `pnpm test` 通过。
**依赖关系:** blockedBy Task 5
**域标签:** `[frontend]`
**复杂度:** `simple`

- [ ] **Step 1:** 在 `api-helpers.ts` 中：删除 L14 `type ErrorBody`，添加 `import { type ErrorBody, GatewayErrorCode } from "@/lib/errors";`。添加 `mapGatewayError`：

```typescript
function mapGatewayError(err: ControlPlaneGatewayError): string {
  // Map known Gateway error codes to GatewayErrorCode values
  const code = err.code;
  if (code && code in GatewayErrorCode) return code;
  return GatewayErrorCode.GATEWAY_ERROR;
}
```

在 gwRequest 和 gatewayRequest 的 catch 块中，将 `code: err.code` 改为 `code: mapGatewayError(err)`。

- [ ] **Step 2:** 在 `with-auth.ts` 中：删除 `type ErrorBody`，添加 `import type { ErrorBody } from "@/lib/errors";`
- [ ] **Step 3:** 在 `chat-api.ts` 中：删除 `type ApiErrorBody`，添加 `import type { ErrorBody } from "@/lib/errors";`，将 `ApiErrorBody` 替换为 `ErrorBody`
- [ ] **Step 4:** 验证 grep + `pnpm check` + `pnpm test`
- [ ] **Step 5:** Commit

### Task 7: Migrate 5 stores to fetchApi

**Files:**

- Modify: `dashboard/src/stores/webhooks.ts`
- Modify: `dashboard/src/stores/cron.ts`
- Modify: `dashboard/src/stores/skills.ts`
- Modify: `dashboard/src/stores/budget.ts`
- Modify: `dashboard/src/stores/alerts.ts`

**实施描述:** 将 5 个 store 中的重复 fetch 样板迁移到 `fetchApi()`。
**验收标准:** 5 个 store 使用 fetchApi，无重复 res.ok 检查样板。
**测试要求:** `pnpm check` + `pnpm test`。
**依赖关系:** blockedBy Task 5
**域标签:** `[frontend]`
**复杂度:** `simple`

- [ ] **Step 1-5:** 逐个 store 迁移（webhooks → cron → skills → budget → alerts），将三段式 try-catch 替换为 fetchApi 一行调用
- [ ] **Step 6:** 运行 `pnpm check` + `pnpm test`
- [ ] **Step 7:** Commit

### Task 8: Panel Registry — create registry + derive Panel type

**Files:**

- Create: `dashboard/src/lib/panel-registry.ts`
- Modify: `dashboard/src/stores/ui.ts:18-41`

**实施描述:** 创建 PanelRegistry。Chat 使用 eager static import，其余 lazy。Panel type 从 registry 派生。
**验收标准:** `Panel` type 从 PANELS 派生。`pnpm check` 通过。
**测试要求:** `pnpm check`。
**依赖关系:** 无
**域标签:** `[frontend]`
**复杂度:** `complex`

- [ ] **Step 1:** 创建 `dashboard/src/lib/panel-registry.ts`：

```typescript
import {
  MessageSquare,
  Bot,
  Radio,
  Cpu,
  BarChart3,
  ScrollText,
  Brain,
  FileText,
  Activity,
  Clock,
  Webhook,
  ShieldCheck,
  Wrench,
  Wallet,
  Bell,
  Share2,
  GitBranch,
  Network,
  Settings,
  FileCode,
  Fingerprint,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
// ChatPanel is the default — static import to avoid flash-of-loading.
import { ChatPanel } from "@/components/panels/chat/ChatPanel";

type PanelComponent = ComponentType | LazyExoticComponent<ComponentType>;

export interface PanelEntry {
  readonly id: string;
  readonly group: "core" | "observe" | "automate" | "control";
  readonly icon: LucideIcon;
  readonly labelKey: string;
  readonly component: PanelComponent;
  readonly shortcutIndex?: number;
  readonly eager?: boolean;
  readonly position?: "bottom";
}

export const PANELS = [
  {
    id: "chat",
    group: "core",
    icon: MessageSquare,
    labelKey: "chat",
    component: ChatPanel,
    shortcutIndex: 1,
    eager: true,
  },
  {
    id: "agents",
    group: "core",
    icon: Bot,
    labelKey: "agents",
    component: lazy(() =>
      import("@/components/panels/agents/AgentsPanel").then((m) => ({ default: m.AgentsPanel })),
    ),
    shortcutIndex: 2,
  },
  {
    id: "gateway",
    group: "core",
    icon: Radio,
    labelKey: "gateway",
    component: lazy(() =>
      import("@/components/panels/monitor/MonitorPanel").then((m) => ({ default: m.MonitorPanel })),
    ),
    shortcutIndex: 3,
  },
  {
    id: "models",
    group: "core",
    icon: Cpu,
    labelKey: "models",
    component: lazy(() =>
      import("@/components/panels/models/ModelsPanel").then((m) => ({ default: m.ModelsPanel })),
    ),
    shortcutIndex: 4,
  },
  // ... (22 entries total, all following same pattern)
  {
    id: "settings",
    group: "control",
    icon: Settings,
    labelKey: "settings",
    component: lazy(() =>
      import("@/components/panels/settings/SettingsPanel").then((m) => ({
        default: m.SettingsPanel,
      })),
    ),
    position: "bottom",
  },
] as const satisfies readonly PanelEntry[];

export type Panel = (typeof PANELS)[number]["id"];

export function getPanelGroups() {
  const groups = ["core", "observe", "automate", "control"] as const;
  return groups.map((g) => ({
    titleKey: g,
    items: PANELS.filter((p) => p.group === g && !p.position),
  }));
}

export function getBottomPanels() {
  return PANELS.filter((p) => p.position === "bottom");
}
export function getShortcutPanels() {
  return PANELS.filter((p) => p.shortcutIndex != null).sort(
    (a, b) => a.shortcutIndex! - b.shortcutIndex!,
  );
}
export function findPanel(id: string) {
  return PANELS.find((p) => p.id === id);
}
```

关键点：ChatPanel 是 **静态 import**（不是 lazy），其他全部 lazy。`as const satisfies readonly PanelEntry[]` 保留字面量类型。

- [ ] **Step 2:** 修改 `stores/ui.ts`：删除 L18-41 手写 union，改为 `import { type Panel } from "@/lib/panel-registry"; export type { Panel };`
- [ ] **Step 3:** 运行 `pnpm check`
- [ ] **Step 4:** Commit

### Task 9: Panel Registry — migrate NavRail + page.tsx + shortcuts

**Files:**

- Modify: `dashboard/src/components/layout/NavRail.tsx`
- Modify: `dashboard/src/app/page.tsx`
- Modify: `dashboard/src/hooks/useKeyboardShortcuts.ts`

**实施描述:** 3 个 touch point 改为从 registry 读取。NavRail 需要注意字段名变化（`item.panel` → `item.id`）。page.tsx 的 ActivePanel 使用 `entry.eager` 判断是否需要 Suspense。
**验收标准:** 3 个文件中不再有硬编码面板列表。`pnpm check` + `pnpm build` 通过。
**测试要求:** `pnpm check` + `pnpm build`（hard gate — lazy-loading 边界变更）。
**依赖关系:** blockedBy Task 8
**域标签:** `[frontend]`
**复杂度:** `complex`

- [ ] **Step 1:** 修改 `NavRail.tsx`：
  - 删除 L36-45 `NavItem`/`NavGroup` 接口
  - 删除 L47-90 `navGroups` 常量
  - 删除顶部大量 lucide icon imports
  - 添加 `import { getPanelGroups, getBottomPanels, type PanelEntry } from "@/lib/panel-registry";`
  - 渲染中将 `navGroups` 替换为 `getPanelGroups()`
  - 将 `item.panel` 替换为 `item.id`（遍历所有引用点）
  - Settings 底部区域改用 `getBottomPanels()` 遍历

- [ ] **Step 2:** 修改 `page.tsx`：
  - 删除 L11 `import { ChatPanel }`（已在 registry 中 eager import）
  - 删除 L18-93 所有 Lazy\* 常量
  - 删除 L124-177 if-else 链
  - 新 `ActivePanel`：

```typescript
import { findPanel } from "@/lib/panel-registry";

function ActivePanel({ panel }: { panel: Panel }) {
  const entry = findPanel(panel);
  if (!entry) return <PanelPlaceholder panel={panel} />;
  const PanelComponent = entry.component;
  if (entry.eager) return <PanelComponent />;
  return (
    <Suspense fallback={<PanelLoadingFallback />}>
      <PanelComponent />
    </Suspense>
  );
}
```

- [ ] **Step 3:** 修改 `useKeyboardShortcuts.ts`：删除 L10-20 `NAV_PANELS`，改为 `import { getShortcutPanels } from "@/lib/panel-registry";` + `const NAV_PANELS = getShortcutPanels().map((p) => p.id as Panel);`
- [ ] **Step 4:** 运行 `pnpm check` + `pnpm build` (**hard gate**)
- [ ] **Step 5:** Commit

### Task 10: Coverage Gate Automation Script

**Files:**

- Create: `scripts/protocol-coverage-check.ts`
- Modify: `package.json`

**实施描述:** 创建覆盖率检查脚本。使用 `allMethodDefs` import 判定 typed（需 `def.params && def.result` 同时存在），不用 regex 解析 generated files。
**验收标准:** `pnpm protocol:coverage:check` 输出覆盖报告。
**测试要求:** 脚本 exit 0。
**依赖关系:** 无（可与其他 task 并行）
**域标签:** `[backend]`
**复杂度:** `complex`

- [ ] **Step 1:** 创建 `scripts/protocol-coverage-check.ts`：

```typescript
#!/usr/bin/env tsx
import { allMethodDefs, allMethodNames } from "../src/gateway/method-registry-data.js";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");

// 1. Typed methods = have both params AND result schema
const typedMethods = new Set(
  Object.entries(allMethodDefs)
    .filter(([, def]) => def.params && def.result)
    .map(([method]) => method),
);

// 2. Untyped gatewayRequest calls from dashboard API routes
const apiRoot = join(ROOT, "dashboard/src/app/api");
const grepOutput = execSync(`grep -roh 'gatewayRequest("[^"]*"' "${apiRoot}" || true`, {
  encoding: "utf-8",
});
const untypedMethods = new Set<string>();
for (const match of grepOutput.matchAll(/gatewayRequest\("([^"]+)"/g)) {
  if (!typedMethods.has(match[1])) untypedMethods.add(match[1]);
}

// 3. Output report
console.log("=== Protocol Coverage Report ===\n");
console.log(`Total registered methods: ${allMethodNames.length}`);
console.log(`Typed (params + result): ${typedMethods.size}`);
console.log(`Untyped (gatewayRequest only): ${untypedMethods.size}`);
console.log(`\nTyped methods: ${[...typedMethods].sort().join(", ")}`);
console.log(`Untyped methods: ${[...untypedMethods].sort().join(", ")}`);
```

- [ ] **Step 2:** 在 `package.json` 添加 `"protocol:coverage:check": "tsx scripts/protocol-coverage-check.ts"`
- [ ] **Step 3:** 运行 `pnpm protocol:coverage:check` 验证
- [ ] **Step 4:** Commit

### Task 11: Clean up tools.effective dead route

**Files:**

- Modify: `dashboard/src/app/api/deck/tools-effective/route.ts`
- Modify: `dashboard/src/stores/deck-agents.ts`

**实施描述:** `tools.effective` 在 Gateway 中不存在（无 handler）。清理 dashboard 中对它的调用：将 API route 改为从 `tools.catalog` 获取数据后 client-side 过滤，或标记为 stub 待 Gateway 实现。
**验收标准:** dashboard 不再调用不存在的 `tools.effective` 方法。`pnpm check` 通过。
**测试要求:** `pnpm check` + `pnpm test`。
**依赖关系:** 无
**域标签:** `[frontend]`
**复杂度:** `simple`

- [ ] **Step 1:** 确认 `tools.effective` 是否在 Gateway 方法列表中注册（如果连方法名都不在 server-methods-list.ts 中，调用一定返回 unknown method 错误）
- [ ] **Step 2:** 将 `dashboard/src/app/api/deck/tools-effective/route.ts` 改为使用 `tools.catalog` + client-side policy filtering，或者在 route 中添加临时 stub 返回空结果
- [ ] **Step 3:** 运行 `pnpm check` + `pnpm test`
- [ ] **Step 4:** Commit

### Task 12: Matrix Status Updates + Final Validation

**Files:**

- Modify: `docs/plans/2026-04-03-deck-web-replacement-matrix.md`

**实施描述:** 更新 matrix 中 4 个模块的状态 + 全量验证。
**验收标准:** matrix 反映真实状态。`pnpm check` + `pnpm test` + `pnpm build` 全绿。
**测试要求:** `pnpm check` + `pnpm test` + `pnpm build`（三项全量验证）。
**依赖关系:** blockedBy 全部前置 tasks
**域标签:** `[docs]`
**复杂度:** `simple`

- [ ] **Step 1:** Gateway Transport: `partial` → `replacement-ready`（备注：4 upstream schemas 补齐 + dead route cleaned）
- [ ] **Step 2:** Shared Error/Mutation: 备注更新 "unified error codes done; rollback API deferred"（保持 `partial`）
- [ ] **Step 3:** Shell/Panel: `partial` → `replacement-ready`（PanelRegistry 动态注册）
- [ ] **Step 4:** Capability Coverage Gate: `partial` → `replacement-ready`（`pnpm protocol:coverage:check` 就绪）
- [ ] **Step 5:** 运行 **`pnpm check` + `pnpm test` + `pnpm build`** 三项全量验证
- [ ] **Step 6:** Commit: `scripts/committer "[enhanced][codex-finish] docs(deck): update matrix — 3 modules to replacement-ready after platform hardening" docs/plans/2026-04-03-deck-web-replacement-matrix.md`
