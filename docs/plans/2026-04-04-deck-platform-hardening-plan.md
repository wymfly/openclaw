# Deck Platform Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 4 platform gaps blocking upstream iteration: upstream result schemas, unified error model, panel registry, coverage gate automation.

**Architecture:** 4 independent capabilities with minimal cross-dependency. Task 1 (schemas) enables typed client migration. Task 2 (errors) is self-contained. Task 3 (panel registry) refactors 5 touch points into one. Task 4 (coverage script) reads existing artifacts. Task 5 ties up matrix status.

**Tech Stack:** TypeBox (schema), TypeScript, Next.js, Zustand, Vitest

**OpenSpec:** `openspec/changes/deck-platform-hardening/`

---

### Task 1: Upstream Result Schemas — sessions.usage

**Files:**

- Modify: `src/gateway/server-methods/usage.ts`
- Modify: `src/gateway/protocol/schema/usage-schemas.ts` (create if not exists)
- Modify: `src/gateway/method-registry-data.ts`

**实施描述:** 为 `sessions.usage` 方法添加 result schema 和 methodDefs。
**验收标准:** `pnpm protocol:gen:ts` 后 `sessions.usage` 出现在 GatewayMethodMap 中。
**测试要求:** `pnpm protocol:gen:check` 通过。
**依赖关系:** 无
**域标签:** `[backend]`
**复杂度:** `complex`

- [ ] **Step 1:** 读取 handler `src/gateway/server-methods/usage.ts:368-809`，确认 `sessions.usage` 的 `respond(true, ...)` 返回结构
- [ ] **Step 2:** 在 `src/gateway/protocol/schema/` 下创建或扩展 usage result schemas 文件，定义 `SessionsUsageResultSchema`（TypeBox `Type.Object`）
- [ ] **Step 3:** 在 `src/gateway/server-methods/usage.ts` 中导出 `usageMethodDefs` 对象，为 `sessions.usage` 注册 `params` + `result` + `scope`
- [ ] **Step 4:** 在 `src/gateway/method-registry-data.ts` 中 import `usageMethodDefs` 并 spread 到 `allMethodDefs`
- [ ] **Step 5:** 运行 `pnpm protocol:gen:ts` 验证 `sessions.usage` 出现在生成的 GatewayMethodMap
- [ ] **Step 6:** Commit: `scripts/committer "[enhanced][codex-impl] feat(gateway): add sessions.usage result schema" src/gateway/server-methods/usage.ts src/gateway/protocol/schema/ src/gateway/method-registry-data.ts dashboard/src/types/gateway-protocol.generated.ts dashboard/src/types/gateway-client.generated.ts`

### Task 2: Upstream Result Schemas — sessions.usage.logs + sessions.usage.timeseries

**Files:**

- Modify: `src/gateway/server-methods/usage.ts`
- Modify: `src/gateway/protocol/schema/usage-schemas.ts`
- Modify: `src/gateway/method-registry-data.ts`

**实施描述:** 为 `sessions.usage.logs` 和 `sessions.usage.timeseries` 添加 result schemas。
**验收标准:** 两个方法都出现在 GatewayMethodMap 中。
**测试要求:** `pnpm protocol:gen:check` 通过。
**依赖关系:** blockedBy Task 1（共享 usageMethodDefs 对象）
**域标签:** `[backend]`
**复杂度:** `simple`

- [ ] **Step 1:** 读取 `sessions.usage.logs` handler（usage.ts:847-876），确认返回 `{ logs: SessionLogEntry[] }`
- [ ] **Step 2:** 在 usage schemas 文件中定义 `SessionsUsageLogsResultSchema`
- [ ] **Step 3:** 读取 `sessions.usage.timeseries` handler（usage.ts:810-846），确认返回结构
- [ ] **Step 4:** 在 usage schemas 文件中定义 `SessionsUsageTimeseriesResultSchema`
- [ ] **Step 5:** 在 `usageMethodDefs` 中注册两个方法的 result schema
- [ ] **Step 6:** 运行 `pnpm protocol:gen:ts` + `pnpm protocol:gen:check`
- [ ] **Step 7:** Commit: `scripts/committer "[enhanced][codex-impl] feat(gateway): add sessions.usage.logs + timeseries result schemas" ...`

### Task 3: Upstream Result Schemas — skills.install

**Files:**

- Modify: `src/gateway/server-methods/skills.ts`
- Modify: `src/gateway/protocol/schema/` (skills result schema)
- Modify: `src/gateway/method-registry-data.ts`

**实施描述:** 为 `skills.install` 添加 result schema。Handler 有两条返回路径（clawhub 和常规），schema 取并集。
**验收标准:** `skills.install` 出现在 GatewayMethodMap 中。
**测试要求:** `pnpm protocol:gen:check` 通过。
**依赖关系:** 无
**域标签:** `[backend]`
**复杂度:** `simple`

- [ ] **Step 1:** 读取 `skills.install` handler（skills.ts:121-189），确认两条路径的返回值：clawhub（ok/message/stdout/stderr/code/slug/version/targetDir）和常规（ok/message/stdout/stderr/code/warnings?）
- [ ] **Step 2:** 定义 `SkillsInstallResultSchema` — 使用 `Type.Object` 覆盖并集字段（ok, message, stdout, stderr, code, 加 optional slug/version/targetDir/warnings）
- [ ] **Step 3:** 在 `skills.ts` 中导出 `skillsMethodDefs`，注册 `skills.install`
- [ ] **Step 4:** 在 `method-registry-data.ts` 中接入 `skillsMethodDefs`
- [ ] **Step 5:** 运行 `pnpm protocol:gen:ts` + `pnpm protocol:gen:check`
- [ ] **Step 6:** Commit

### Task 4: Migrate Dashboard API Routes to typed gwRequest

**Files:**

- Modify: `dashboard/src/app/api/usage/sessions/route.ts`
- Modify: `dashboard/src/app/api/usage/sessions/logs/route.ts`
- Modify: `dashboard/src/app/api/usage/timeseries/route.ts`
- Modify: `dashboard/src/app/api/skills/install/route.ts`

**实施描述:** 将 4 个 API routes 从 `gatewayRequest()` 迁移到 typed `gwRequest()`。
**验收标准:** 4 个文件中不再有 `gatewayRequest` 调用。`pnpm check` 通过。
**测试要求:** `pnpm check` + `pnpm build` 通过。
**依赖关系:** blockedBy Task 1, 2, 3
**域标签:** `[frontend]`
**复杂度:** `simple`

- [ ] **Step 1:** 在 `dashboard/src/app/api/usage/sessions/route.ts` 中：将 `import { gatewayRequest }` 改为 `import { gwRequest }`，将 `gatewayRequest("sessions.usage", params)` 改为 `gwRequest("sessions.usage", params)`
- [ ] **Step 2:** 同样修改 `usage/sessions/logs/route.ts`：`gatewayRequest("sessions.usage.logs", ...)` → `gwRequest("sessions.usage.logs", ...)`
- [ ] **Step 3:** 同样修改 `usage/timeseries/route.ts`：`gatewayRequest("sessions.usage.timeseries", ...)` → `gwRequest("sessions.usage.timeseries", ...)`
- [ ] **Step 4:** 同样修改 `skills/install/route.ts`：`gatewayRequest("skills.install", ...)` → `gwRequest("skills.install", ...)`
- [ ] **Step 5:** 运行 `pnpm check` + `pnpm build` 验证
- [ ] **Step 6:** Commit: `scripts/committer "[enhanced][codex-impl] refactor(deck): migrate 4 API routes to typed gwRequest" dashboard/src/app/api/usage/sessions/route.ts dashboard/src/app/api/usage/sessions/logs/route.ts dashboard/src/app/api/usage/timeseries/route.ts dashboard/src/app/api/skills/install/route.ts`

### Task 5: Unified Error Model — errors.ts

**Files:**

- Create: `dashboard/src/lib/errors.ts`
- Test: `dashboard/src/lib/__tests__/errors.test.ts`

**实施描述:** 创建统一错误模型文件：GatewayErrorCode 枚举、DeckApiError class、ErrorBody 类型、fetchApi helper、mapGatewayError 映射函数。
**验收标准:** errors.ts 导出所有 5 个公共 API。test 全部通过。
**测试要求:** 单元测试覆盖 fetchApi 的 4 种场景（200 成功、502 Gateway error、401/429、网络失败）。
**依赖关系:** 无
**域标签:** `[frontend]`
**复杂度:** `complex`

- [ ] **Step 1:** 创建 `dashboard/src/lib/__tests__/errors.test.ts`，编写 fetchApi 测试：

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("fetchApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ skills: [] }),
      }),
    );
    const { fetchApi } = await import("@/lib/errors");
    const result = await fetchApi<{ skills: unknown[] }>("/api/skills");
    expect(result).toEqual({ skills: [] });
  });

  it("throws DeckApiError on 502 with code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: "timeout", code: "GATEWAY_ERROR" }),
      }),
    );
    const { fetchApi, DeckApiError } = await import("@/lib/errors");
    await expect(fetchApi("/api/skills")).rejects.toThrow(DeckApiError);
    try {
      await fetchApi("/api/skills");
    } catch (e) {
      expect((e as InstanceType<typeof DeckApiError>).code).toBe("GATEWAY_ERROR");
      expect((e as InstanceType<typeof DeckApiError>).status).toBe(502);
    }
  });

  it("throws DeckApiError with INTERNAL on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { fetchApi, DeckApiError } = await import("@/lib/errors");
    await expect(fetchApi("/api/skills")).rejects.toThrow(DeckApiError);
  });
});
```

- [ ] **Step 2:** 运行测试确认失败：`cd dashboard && pnpm test -- src/lib/__tests__/errors.test.ts`
- [ ] **Step 3:** 创建 `dashboard/src/lib/errors.ts`：

```typescript
export type ErrorBody = { error: string; code?: string };

export const GatewayErrorCode = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  GATEWAY_ERROR: "GATEWAY_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  VALIDATION: "VALIDATION",
  INTERNAL: "INTERNAL",
} as const;

export type GatewayErrorCode = (typeof GatewayErrorCode)[keyof typeof GatewayErrorCode];

export class DeckApiError extends Error {
  constructor(
    public readonly code: GatewayErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DeckApiError";
  }
}

function statusToCode(status: number, bodyCode?: string): GatewayErrorCode {
  if (bodyCode && bodyCode in GatewayErrorCode) {
    return bodyCode as GatewayErrorCode;
  }
  if (status === 401) return GatewayErrorCode.UNAUTHORIZED;
  if (status === 429) return GatewayErrorCode.RATE_LIMITED;
  if (status === 503) return GatewayErrorCode.NOT_CONFIGURED;
  if (status === 502) return GatewayErrorCode.GATEWAY_ERROR;
  if (status === 400) return GatewayErrorCode.VALIDATION;
  return GatewayErrorCode.INTERNAL;
}

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new DeckApiError(
      GatewayErrorCode.INTERNAL,
      err instanceof Error ? err.message : "Network error",
      0,
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    const { error, code } = body as ErrorBody;
    throw new DeckApiError(
      statusToCode(res.status, code),
      error ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return (await res.json()) as T;
}
```

- [ ] **Step 4:** 运行测试确认通过：`cd dashboard && pnpm test -- src/lib/__tests__/errors.test.ts`
- [ ] **Step 5:** 运行 `pnpm check`
- [ ] **Step 6:** Commit: `scripts/committer "[enhanced][codex-impl] feat(deck): unified error model — errors.ts + tests" dashboard/src/lib/errors.ts dashboard/src/lib/__tests__/errors.test.ts`

### Task 6: Unified Error Model — consolidate ErrorBody imports

**Files:**

- Modify: `dashboard/src/lib/api-helpers.ts:14`
- Modify: `dashboard/src/lib/with-auth.ts:17`
- Modify: `dashboard/src/components/panels/chat/chat-api.ts:33`

**实施描述:** 将 3 处重复的 ErrorBody/ApiErrorBody 定义替换为从 errors.ts 导入。gwRequest 返回契约不变。
**验收标准:** `grep -r "type ErrorBody\|type ApiErrorBody" dashboard/src/` 仅命中 errors.ts。
**测试要求:** `pnpm check` + `pnpm test` 通过。
**依赖关系:** blockedBy Task 5
**域标签:** `[frontend]`
**复杂度:** `simple`

- [ ] **Step 1:** 在 `dashboard/src/lib/api-helpers.ts` 中：删除 L14 `type ErrorBody = { error: string; code?: string };`，添加 `import type { ErrorBody } from "@/lib/errors";`
- [ ] **Step 2:** 在 `dashboard/src/lib/with-auth.ts` 中：删除 L17 `type ErrorBody = { error: string };`，添加 `import type { ErrorBody } from "@/lib/errors";`
- [ ] **Step 3:** 在 `dashboard/src/components/panels/chat/chat-api.ts` 中：删除 L33 `type ApiErrorBody = { error?: string };`，添加 `import type { ErrorBody } from "@/lib/errors";`，将内部使用的 `ApiErrorBody` 替换为 `ErrorBody`
- [ ] **Step 4:** 验证：`grep -rn "type ErrorBody\|type ApiErrorBody" dashboard/src/` 仅命中 `dashboard/src/lib/errors.ts`
- [ ] **Step 5:** 运行 `pnpm check` + `pnpm test`
- [ ] **Step 6:** Commit: `scripts/committer "[enhanced][codex-impl] refactor(deck): consolidate ErrorBody to single definition" dashboard/src/lib/api-helpers.ts dashboard/src/lib/with-auth.ts dashboard/src/components/panels/chat/chat-api.ts`

### Task 7: Unified Error Model — migrate stores to fetchApi

**Files:**

- Modify: `dashboard/src/stores/webhooks.ts`
- Modify: `dashboard/src/stores/cron.ts`
- Modify: `dashboard/src/stores/skills.ts`

**实施描述:** 将 3 个 store 中的重复 fetch 样板迁移到 fetchApi()。
**验收标准:** 3 个 store 中的 fetch 调用使用 fetchApi，不再有 `res.ok` 检查样板。
**测试要求:** `pnpm check` + `pnpm test` 通过。
**依赖关系:** blockedBy Task 5
**域标签:** `[frontend]`
**复杂度:** `simple`

- [ ] **Step 1:** 在各 store 中，将 try-catch + res.ok + json 三段式替换为 `fetchApi<T>(url)` 一行调用。DeckApiError 在 catch 块中取 message。示例模式：

```typescript
// Before:
try {
  const res = await fetch("/api/webhooks");
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    set({ error: body.error ?? "Failed", loading: false });
    return;
  }
  const data = (await res.json()) as { webhooks: Webhook[] };
  set({ webhooks: data.webhooks, loading: false });
} catch (err) {
  set({ error: err instanceof Error ? err.message : "Failed", loading: false });
}

// After:
import { fetchApi, DeckApiError } from "@/lib/errors";
try {
  const data = await fetchApi<{ webhooks: Webhook[] }>("/api/webhooks");
  set({ webhooks: data.webhooks, loading: false });
} catch (err) {
  set({ error: err instanceof DeckApiError ? err.message : "Failed", loading: false });
}
```

- [ ] **Step 2:** 对 webhooks.ts, cron.ts, skills.ts 逐个应用此模式
- [ ] **Step 3:** 运行 `pnpm check` + `pnpm test`
- [ ] **Step 4:** Commit: `scripts/committer "[enhanced][codex-impl] refactor(deck): migrate 3 stores to fetchApi" dashboard/src/stores/webhooks.ts dashboard/src/stores/cron.ts dashboard/src/stores/skills.ts`

### Task 8: Panel Registry — create registry + derive Panel type

**Files:**

- Create: `dashboard/src/lib/panel-registry.ts`
- Modify: `dashboard/src/stores/ui.ts:18-41`

**实施描述:** 创建集中 PanelRegistry（PANELS 数组 + PanelEntry 类型），将 ui.ts 的手写 Panel union 改为从 registry 派生。
**验收标准:** `Panel` type 从 PANELS 派生。`pnpm check` 通过。
**测试要求:** `pnpm check`（TypeScript 类型验证即可）。
**依赖关系:** 无
**域标签:** `[frontend]`
**复杂度:** `complex`

- [ ] **Step 1:** 创建 `dashboard/src/lib/panel-registry.ts`，定义 PANELS 数组（24 entries）。参考 `NavRail.tsx:47-90` 的 navGroups 和 `page.tsx:18-93` 的 lazy imports：

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
import { lazy, type ComponentType } from "react";

export interface PanelEntry {
  readonly id: string;
  readonly group: "core" | "observe" | "automate" | "control";
  readonly icon: LucideIcon;
  readonly labelKey: string;
  readonly component: ComponentType;
  readonly shortcutIndex?: number;
  readonly eager?: boolean;
  readonly position?: "bottom";
}

// ChatPanel is eagerly imported — must be static to avoid flash-of-loading.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- eager import
const ChatPanelEager = lazy(() =>
  import("@/components/panels/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })),
);

export const PANELS = [
  {
    id: "chat",
    group: "core",
    icon: MessageSquare,
    labelKey: "chat",
    component: ChatPanelEager,
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
  {
    id: "usage",
    group: "observe",
    icon: BarChart3,
    labelKey: "usage",
    component: lazy(() =>
      import("@/components/panels/usage/UsagePanel").then((m) => ({ default: m.UsagePanel })),
    ),
    shortcutIndex: 5,
  },
  {
    id: "sessions",
    group: "observe",
    icon: ScrollText,
    labelKey: "sessions",
    component: lazy(() =>
      import("@/components/panels/sessions/SessionsPanel").then((m) => ({
        default: m.SessionsPanel,
      })),
    ),
    shortcutIndex: 6,
  },
  {
    id: "memory",
    group: "observe",
    icon: Brain,
    labelKey: "memory",
    component: lazy(() =>
      import("@/components/panels/memory/MemoryPanel").then((m) => ({ default: m.MemoryPanel })),
    ),
    shortcutIndex: 7,
  },
  {
    id: "logs",
    group: "observe",
    icon: FileText,
    labelKey: "logs",
    component: lazy(() =>
      import("@/components/panels/logs/LogsPanel").then((m) => ({ default: m.LogsPanel })),
    ),
    shortcutIndex: 8,
  },
  {
    id: "activity",
    group: "observe",
    icon: Activity,
    labelKey: "activity",
    component: lazy(() =>
      import("@/components/panels/activity/ActivityPanel").then((m) => ({
        default: m.ActivityPanel,
      })),
    ),
    shortcutIndex: 9,
  },
  {
    id: "threads",
    group: "observe",
    icon: MessagesSquare,
    labelKey: "threads",
    component: lazy(() =>
      import("@/components/panels/threads/ThreadsPanel").then((m) => ({ default: m.ThreadsPanel })),
    ),
  },
  {
    id: "cron",
    group: "automate",
    icon: Clock,
    labelKey: "cron",
    component: lazy(() =>
      import("@/components/panels/scheduler/SchedulerPanel").then((m) => ({
        default: m.SchedulerPanel,
      })),
    ),
  },
  {
    id: "webhooks",
    group: "automate",
    icon: Webhook,
    labelKey: "webhooks",
    component: lazy(() =>
      import("@/components/panels/webhooks/WebhooksPanel").then((m) => ({
        default: m.WebhooksPanel,
      })),
    ),
  },
  {
    id: "approvals",
    group: "automate",
    icon: ShieldCheck,
    labelKey: "approvals",
    component: lazy(() =>
      import("@/components/panels/approvals/ApprovalsPanel").then((m) => ({
        default: m.ApprovalsPanel,
      })),
    ),
  },
  {
    id: "skills",
    group: "automate",
    icon: Wrench,
    labelKey: "skills",
    component: lazy(() =>
      import("@/components/panels/skills/SkillsPanel").then((m) => ({ default: m.SkillsPanel })),
    ),
  },
  {
    id: "budget",
    group: "control",
    icon: Wallet,
    labelKey: "budget",
    component: lazy(() =>
      import("@/components/panels/budget/BudgetPanel").then((m) => ({ default: m.BudgetPanel })),
    ),
  },
  {
    id: "alerts",
    group: "control",
    icon: Bell,
    labelKey: "alerts",
    component: lazy(() =>
      import("@/components/panels/alerts/AlertsPanel").then((m) => ({ default: m.AlertsPanel })),
    ),
  },
  {
    id: "channels",
    group: "control",
    icon: Share2,
    labelKey: "channels",
    component: lazy(() =>
      import("@/components/panels/channels/ChannelsPanel").then((m) => ({
        default: m.ChannelsPanel,
      })),
    ),
  },
  {
    id: "routing",
    group: "control",
    icon: GitBranch,
    labelKey: "routing",
    component: lazy(() =>
      import("@/components/panels/routing/RoutingPanel").then((m) => ({ default: m.RoutingPanel })),
    ),
  },
  {
    id: "subagents",
    group: "control",
    icon: Network,
    labelKey: "subagents",
    component: lazy(() =>
      import("@/components/panels/subagents/SubagentsPanel").then((m) => ({
        default: m.SubagentsPanel,
      })),
    ),
  },
  {
    id: "identity",
    group: "control",
    icon: Fingerprint,
    labelKey: "identity",
    component: lazy(() =>
      import("@/components/panels/identity/IdentityPanel").then((m) => ({
        default: m.IdentityPanel,
      })),
    ),
  },
  {
    id: "config",
    group: "control",
    icon: Settings,
    labelKey: "config",
    component: lazy(() =>
      import("@/components/panels/config-editor/ConfigPanel").then((m) => ({
        default: m.ConfigPanel,
      })),
    ),
  },
  {
    id: "docs",
    group: "control",
    icon: FileCode,
    labelKey: "docs",
    component: lazy(() =>
      import("@/components/panels/docs/DocHubPanel").then((m) => ({ default: m.DocHubPanel })),
    ),
  },
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

/** Group PANELS by nav group (excluding bottom-positioned entries). */
export function getPanelGroups(): { titleKey: string; items: readonly PanelEntry[] }[] {
  const groups = ["core", "observe", "automate", "control"] as const;
  return groups.map((g) => ({
    titleKey: g,
    items: PANELS.filter((p) => p.group === g && !p.position),
  }));
}

/** Get bottom-positioned entries (e.g. settings). */
export function getBottomPanels(): readonly PanelEntry[] {
  return PANELS.filter((p) => p.position === "bottom");
}

/** Get panels with shortcut index, sorted by index. */
export function getShortcutPanels(): readonly PanelEntry[] {
  return PANELS.filter((p) => p.shortcutIndex != null).sort(
    (a, b) => a.shortcutIndex! - b.shortcutIndex!,
  );
}

/** Find panel entry by id. */
export function findPanel(id: string): PanelEntry | undefined {
  return PANELS.find((p) => p.id === id);
}
```

- [ ] **Step 2:** 修改 `dashboard/src/stores/ui.ts`：删除 L18-41 的手写 `Panel` union，替换为 `import { type Panel } from "@/lib/panel-registry"; export type { Panel };`
- [ ] **Step 3:** 运行 `pnpm check` 验证类型兼容
- [ ] **Step 4:** Commit: `scripts/committer "[enhanced][codex-impl] feat(deck): panel registry + Panel type derivation" dashboard/src/lib/panel-registry.ts dashboard/src/stores/ui.ts`

### Task 9: Panel Registry — migrate NavRail + page.tsx + useKeyboardShortcuts

**Files:**

- Modify: `dashboard/src/components/layout/NavRail.tsx`
- Modify: `dashboard/src/app/page.tsx`
- Modify: `dashboard/src/hooks/useKeyboardShortcuts.ts`

**实施描述:** 将 NavRail、page.tsx、useKeyboardShortcuts 改为从 PANELS registry 读取，移除硬编码列表。
**验收标准:** 3 个文件中不再有硬编码面板列表。`pnpm check` + `pnpm build` 通过。
**测试要求:** `pnpm check` + `pnpm build`（lazy-loading 变更必须通过 build）。
**依赖关系:** blockedBy Task 8
**域标签:** `[frontend]`
**复杂度:** `complex`

- [ ] **Step 1:** 修改 `NavRail.tsx`：删除 L47-90 的 `navGroups` 常量和 `NavItem`/`NavGroup` 接口，改为 `import { getPanelGroups, getBottomPanels, type PanelEntry } from "@/lib/panel-registry";`。在渲染中用 `getPanelGroups()` 替代 `navGroups`，用 `getBottomPanels()` 替代底部 settings 的硬编码。Lucide icon imports 可删除（从 registry 读取）。
- [ ] **Step 2:** 修改 `page.tsx`：删除 L18-93 的所有 lazy import 常量，删除 L124-177 的 if-else 链。改为从 registry 读取：

```typescript
import { ChatPanel } from "@/components/panels/chat/ChatPanel";
import { findPanel } from "@/lib/panel-registry";

function ActivePanel({ panel }: { panel: Panel }) {
  if (panel === "chat") return <ChatPanel />;
  const entry = findPanel(panel);
  if (!entry) return <PanelPlaceholder panel={panel} />;
  const LazyComponent = entry.component;
  return (
    <Suspense fallback={<PanelLoadingFallback />}>
      <LazyComponent />
    </Suspense>
  );
}
```

- [ ] **Step 3:** 修改 `useKeyboardShortcuts.ts`：删除 L10-20 的 `NAV_PANELS` 常量，改为 `import { getShortcutPanels } from "@/lib/panel-registry";`，用 `getShortcutPanels().map(p => p.id)` 替代。
- [ ] **Step 4:** 运行 `pnpm check` + `pnpm build` 验证（build 是 hard gate，因为改了 lazy-loading 边界）
- [ ] **Step 5:** Commit: `scripts/committer "[enhanced][codex-impl] refactor(deck): NavRail + page + shortcuts read from panel registry" dashboard/src/components/layout/NavRail.tsx dashboard/src/app/page.tsx dashboard/src/hooks/useKeyboardShortcuts.ts`

### Task 10: Coverage Gate Automation Script

**Files:**

- Create: `scripts/protocol-coverage-check.ts`
- Modify: `package.json` (add script)

**实施描述:** 创建自动化覆盖验证脚本，从 method-registry-data 读取所有方法，从 GatewayMethodMap 读取 typed 方法，从 API routes grep untyped 调用，输出覆盖报告。
**验收标准:** `pnpm protocol:coverage:check` 输出覆盖报告，与 matrix Gateway Capability Coverage Baseline 一致。
**测试要求:** 脚本运行成功（exit 0）。
**依赖关系:** 无
**域标签:** `[backend]`
**复杂度:** `complex`

- [ ] **Step 1:** 创建 `scripts/protocol-coverage-check.ts`：

```typescript
#!/usr/bin/env tsx
/**
 * Protocol Coverage Check — reads Gateway method registry + Deck typed client
 * and outputs a coverage report.
 *
 * Usage: pnpm protocol:coverage:check
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const ROOT = join(import.meta.dirname, "..");

// 1. Read all registered method names from method-registry-data.ts
//    Parse allMethodNames export (string array)
const registryFile = readFileSync(join(ROOT, "src/gateway/method-registry-data.ts"), "utf-8");
const allMethodsMatch = registryFile.match(/allMethodNames\s*=\s*\[([\s\S]*?)\]/);
// ... extract method names from the array literal

// 2. Read GatewayMethodMap keys from generated protocol file
const protocolFile = readFileSync(
  join(ROOT, "dashboard/src/types/gateway-protocol.generated.ts"),
  "utf-8",
);
// Parse interface GatewayMethodMap { "method.name": ... }
const typedMethods = new Set<string>();
for (const match of protocolFile.matchAll(/"([\w.]+)":\s*\{/g)) {
  typedMethods.add(match[1]);
}

// 3. Grep untyped gatewayRequest calls from dashboard API routes
const grepOutput = execSync(
  `grep -roh 'gatewayRequest("\\([^"]*\\)"' ${join(ROOT, "dashboard/src/app/api/")} || true`,
  { encoding: "utf-8" },
);
const untypedMethods = new Set<string>();
for (const match of grepOutput.matchAll(/gatewayRequest\("([^"]+)"/g)) {
  untypedMethods.add(match[1]);
}

// 4. Classify and output
// ... group by method family, output table
```

- [ ] **Step 2:** 在 `package.json` 中添加：`"protocol:coverage:check": "tsx scripts/protocol-coverage-check.ts"`
- [ ] **Step 3:** 运行 `pnpm protocol:coverage:check` 验证输出
- [ ] **Step 4:** Commit: `scripts/committer "[enhanced][codex-impl] feat: add protocol coverage check script" scripts/protocol-coverage-check.ts package.json`

### Task 11: Matrix Status Updates

**Files:**

- Modify: `docs/plans/2026-04-03-deck-web-replacement-matrix.md`

**实施描述:** 更新 matrix 中 4 个模块的状态。
**验收标准:** matrix 反映实施后的真实状态。
**测试要求:** `pnpm check` 通过。
**依赖关系:** blockedBy Task 4, 7, 9, 10
**域标签:** `[docs]`
**复杂度:** `simple`

- [ ] **Step 1:** Gateway Transport: `partial` → `replacement-ready`（备注更新：4 upstream schemas 补齐 + typed client 覆盖完整）
- [ ] **Step 2:** Shared Error/Mutation: 备注更新为 "unified error codes done; rollback API deferred"（保持 `partial`）
- [ ] **Step 3:** Shell/Panel: `partial` → `replacement-ready`（备注更新：PanelRegistry 动态注册，新增面板只需 1 entry）
- [ ] **Step 4:** Capability Coverage Gate: `partial` → `replacement-ready`（备注更新：自动化脚本 `pnpm protocol:coverage:check` 就绪）
- [ ] **Step 5:** 运行 `pnpm check`
- [ ] **Step 6:** Commit: `scripts/committer "[enhanced][codex-finish] docs(deck): update matrix — 3 modules to replacement-ready after platform hardening" docs/plans/2026-04-03-deck-web-replacement-matrix.md`

---

## Self-Review Checklist

1. **Spec coverage:** All 5 specs covered (upstream-result-schemas → Tasks 1-4, unified-error-model → Tasks 5-7, panel-registry → Tasks 8-9, coverage-gate-automation → Task 10, gateway-communication → Tasks 1-4).
2. **Placeholder scan:** No TBD/TODO. Code blocks provided for all creation steps. Task 10's script has skeleton structure — implementer fills in parsing logic for specific formats.
3. **Type consistency:** `Panel` type, `PanelEntry`, `fetchApi`, `DeckApiError`, `GatewayErrorCode` — consistent across all tasks.
4. **Note:** `tools.effective` was removed from scope — Gateway has no handler for this method. Scope reduced from 5 to 4 upstream methods (sessions.usage, sessions.usage.logs, sessions.usage.timeseries, skills.install).
