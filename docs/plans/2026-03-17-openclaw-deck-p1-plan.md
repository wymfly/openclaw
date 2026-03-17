# openclaw-deck P1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 panels (Usage & Costs, Sessions, Memory Browser, Logs, Activity Feed, Channels, Config Editor) + memory enhancement transplants — completing the Observe and Configuration groups.

**Architecture:** Follows P0 patterns exactly: `withAuth()` HOF for API routes, `gatewayRequest()` helper for Gateway RPC, Zustand stores < 200 LOC, panel components < 500 LOC, all UI text via `useTranslations()`.

**Tech Stack:** Adds `recharts` for Usage charts, `openai` SDK for memory embedder. All other deps already installed in P0.

**OpenSpec Change:** `openspec/changes/openclaw-deck/` — Tasks sections 4-6.

---

## Pre-G2 Parallel Awareness

### File Ownership Matrix

| Task Group                   | Unique Files                                                                                                | Shared Files                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Usage (T3-T5)                | `src/stores/usage.ts`, `src/app/api/usage/**`, `src/components/panels/usage/**`, `src/lib/token-pricing.ts` | `zh.json`, `en.json`                        |
| Sessions (T6-T7)             | `src/stores/sessions.ts`, `src/app/api/sessions/**`, `src/components/panels/sessions/**`                    | `zh.json`, `en.json`                        |
| Memory (T8-T9)               | `src/stores/memory.ts`, `src/app/api/memory/**`, `src/components/panels/memory/**`                          | `zh.json`, `en.json`                        |
| Logs (T10-T11)               | `src/stores/logs.ts`, `src/app/api/logs/**`, `src/components/panels/logs/**`                                | `zh.json`, `en.json`, `server/event-bus.ts` |
| Activity (T12-T13)           | `src/stores/activity.ts`, `src/app/api/activity/**`, `src/components/panels/activity/**`                    | `zh.json`, `en.json`, `server/event-bus.ts` |
| Channels (T14-T15)           | `src/stores/channels.ts`, `src/app/api/channels/**`, `src/components/panels/channels/**`                    | `zh.json`, `en.json`                        |
| Config Editor (T16-T18)      | `src/stores/config.ts`, `src/app/api/config/**`, `src/components/panels/config-editor/**`                   | `zh.json`, `en.json`                        |
| Memory Enhancement (T19-T22) | `extensions/memory-lancedb/src/**`                                                                          | None                                        |

**Cross-file conflicts:** All dashboard panels share `zh.json`/`en.json` — must be serialized or pre-allocated. Memory Enhancement is fully isolated. Event-bus shared by Logs + Activity (minor: only type union extension needed).

---

## Chunk 1: Shared Infrastructure (Tasks 1–2)

### Task 1: Install P1 Dependencies + Extend Event Types [infra]

covers: tasks.md > 4.1 > "Transplant token-pricing.ts"
covers: tasks.md > 4.3 > "Charts (Recharts)"

**Files:**

- Modify: `dashboard/package.json` (add recharts)
- Modify: `dashboard/server/event-bus.ts` (add P1 event types)

- [ ] **Step 1: Install recharts**

```bash
cd dashboard && pnpm add recharts
```

recharts is needed for Usage & Costs panel charts. It works with React 19.

- [ ] **Step 2: Extend DeckEventType for P1 events**

In `server/event-bus.ts`, extend the `DeckEventType` union to include P1 events:

```typescript
export type DeckEventType =
  | "runtime.status"
  | "gateway.event"
  | "chat"
  | "agent"
  | "agent.updated"
  | "gateway.health"
  | "notification.toast"
  // P1 additions
  | "log.entry"
  | "activity.event";
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/package.json pnpm-lock.yaml dashboard/server/event-bus.ts
git commit -m "[enhanced] [impl] feat(deck): add P1 dependencies and event types"
```

---

### Task 2: Transplant Shared Libraries [backend]

covers: tasks.md > 4.1 > "Transplant token-pricing.ts from Mission Control"
covers: tasks.md > 4.13 > "Transplant message-extract.ts from openclaw-studio"
covers: tasks.md > 4.16 > "Transplant commander.ts from Control Center"

**Files:**

- Create: `dashboard/src/lib/token-pricing.ts`
- Create: `dashboard/src/lib/token-pricing.test.ts`
- Create: `dashboard/src/lib/message-extract.ts`
- Create: `dashboard/src/lib/message-extract.test.ts`
- Create: `dashboard/src/lib/commander.ts`
- Create: `dashboard/src/lib/commander.test.ts`

**Context:** Three libraries are transplanted from vendor projects. Each needs adaptation to remove vendor-specific imports:

**token-pricing.ts** (from `vendor/mission-control/src/lib/token-pricing.ts`, 77 LOC):

- Remove `getProviderFromModel` import (MC-specific)
- Remove `CostOptions.providerSubscriptions` logic (deck doesn't have subscription concept)
- Keep `MODEL_PRICING` table, `getModelPricing()`, and simplified `calculateTokenCost(model, inputTokens, outputTokens)`
- Add DeepSeek V3 pricing: `'deepseek/deepseek-chat-v3'` at `{ inputPerMTok: 0.27, outputPerMTok: 1.1 }`

**message-extract.ts** (from `vendor/openclaw-studio/src/lib/text/message-extract.ts`):

- Keep thinking tag regex parsing, channel envelope detection, tool call extraction
- Remove any studio-specific imports
- Export: `extractText()`, `extractThinking()`, `stripChannelEnvelope()`

**commander.ts** (from `vendor/openclaw-control-center/src/runtime/commander.ts`):

- Simplify to alert classification only: `CommanderAlert` type + `classifyAlerts()` function
- Remove task-store dependency, remove read-model-snapshot dependency
- Input: array of `{ type, count, hasErrors }` status objects
- Output: array of `CommanderAlert` with level (info/warning/critical) and code

- [ ] **Step 1: Write failing tests for token-pricing**

```typescript
// dashboard/src/lib/token-pricing.test.ts
import { describe, it, expect } from "vitest";
import { getModelPricing, calculateTokenCost } from "./token-pricing.js";

describe("getModelPricing", () => {
  it("returns exact match pricing", () => {
    const p = getModelPricing("anthropic/claude-sonnet-4-20250514");
    expect(p.inputPerMTok).toBe(3.0);
    expect(p.outputPerMTok).toBe(15.0);
  });

  it("returns fuzzy match on short name", () => {
    const p = getModelPricing("claude-haiku-4-5");
    expect(p.inputPerMTok).toBe(0.8);
  });

  it("returns default for unknown model", () => {
    const p = getModelPricing("unknown/model-xyz");
    expect(p.inputPerMTok).toBe(3.0); // default
  });
});

describe("calculateTokenCost", () => {
  it("calculates cost in dollars", () => {
    const cost = calculateTokenCost("claude-sonnet-4", 1_000_000, 500_000);
    // input: 1M * 3.0/M = $3.0, output: 0.5M * 15.0/M = $7.5
    expect(cost).toBeCloseTo(10.5);
  });

  it("returns 0 for free models", () => {
    const cost = calculateTokenCost("ollama/deepseek-r1:14b", 100_000, 50_000);
    expect(cost).toBe(0);
  });
});
```

- [ ] **Step 2: Implement token-pricing.ts**

Transplant from `vendor/mission-control/src/lib/token-pricing.ts`. Remove `getProviderFromModel` import and subscription logic. Simplify `calculateTokenCost` signature to `(modelName, inputTokens, outputTokens) => number`.

- [ ] **Step 3: Run tests**

```bash
cd dashboard && pnpm test src/lib/token-pricing.test.ts
```

- [ ] **Step 4: Write failing tests for message-extract**

```typescript
// dashboard/src/lib/message-extract.test.ts
import { describe, it, expect } from "vitest";
import { extractText, extractThinking, stripChannelEnvelope } from "./message-extract.js";

describe("extractText", () => {
  it("strips thinking tags from content", () => {
    const input = "Hello <thinking>internal</thinking> world";
    expect(extractText(input)).toBe("Hello  world");
  });

  it("returns plain text unchanged", () => {
    expect(extractText("Hello world")).toBe("Hello world");
  });
});

describe("extractThinking", () => {
  it("extracts thinking block content", () => {
    const input = "<thinking>deep thought</thinking> response";
    expect(extractThinking(input)).toBe("deep thought");
  });

  it("returns null when no thinking block", () => {
    expect(extractThinking("plain text")).toBeNull();
  });
});

describe("stripChannelEnvelope", () => {
  it("strips [WebChat] prefix", () => {
    expect(stripChannelEnvelope("[WebChat] Hello")).toBe("Hello");
  });

  it("keeps text without channel prefix", () => {
    expect(stripChannelEnvelope("Hello world")).toBe("Hello world");
  });
});
```

- [ ] **Step 5: Implement message-extract.ts**

Transplant from `vendor/openclaw-studio/src/lib/text/message-extract.ts`. Remove studio-specific imports. Keep regex-based parsing, WeakMap caching, and all tag detection logic.

- [ ] **Step 6: Write failing tests for commander**

```typescript
// dashboard/src/lib/commander.test.ts
import { describe, it, expect } from "vitest";
import { classifyAlerts, type StatusEntry } from "./commander.js";

describe("classifyAlerts", () => {
  it("returns empty for healthy status", () => {
    const status: StatusEntry[] = [
      { type: "sessions", count: 5, hasErrors: false },
      { type: "channels", count: 3, hasErrors: false },
    ];
    expect(classifyAlerts(status)).toEqual([]);
  });

  it("returns warning for errors", () => {
    const status: StatusEntry[] = [{ type: "sessions", count: 2, hasErrors: true }];
    const alerts = classifyAlerts(status);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("warning");
    expect(alerts[0].code).toBe("HAS_ERRORS");
  });

  it("returns critical for no sessions", () => {
    const status: StatusEntry[] = [{ type: "sessions", count: 0, hasErrors: false }];
    const alerts = classifyAlerts(status);
    expect(alerts.some((a) => a.code === "NO_SESSIONS")).toBe(true);
  });
});
```

- [ ] **Step 7: Implement commander.ts**

Simplified version of `vendor/openclaw-control-center/src/runtime/commander.ts`:

```typescript
// dashboard/src/lib/commander.ts
export type AlertLevel = "info" | "warning" | "critical";

export interface StatusEntry {
  type: string;
  count: number;
  hasErrors: boolean;
}

export interface CommanderAlert {
  level: AlertLevel;
  code: string;
  message: string;
}

export function classifyAlerts(entries: StatusEntry[]): CommanderAlert[] {
  const alerts: CommanderAlert[] = [];

  for (const entry of entries) {
    if (entry.type === "sessions" && entry.count === 0) {
      alerts.push({ level: "critical", code: "NO_SESSIONS", message: "No active sessions" });
    }
    if (entry.hasErrors) {
      alerts.push({
        level: "warning",
        code: "HAS_ERRORS",
        message: `${entry.type} has errors`,
      });
    }
  }

  return alerts;
}
```

- [ ] **Step 8: Run all tests and commit**

```bash
cd dashboard && pnpm test src/lib/
git add dashboard/src/lib/token-pricing.ts dashboard/src/lib/token-pricing.test.ts \
  dashboard/src/lib/message-extract.ts dashboard/src/lib/message-extract.test.ts \
  dashboard/src/lib/commander.ts dashboard/src/lib/commander.test.ts
git commit -m "[enhanced] [impl] feat(deck): transplant token-pricing, message-extract, commander"
```

---

## Chunk 2: Usage & Costs Panel (Tasks 3–5)

### Task 3: Usage Store + API Routes [backend]

covers: usage-tracking/spec.md > ADDED > token-consumption-aggregation > "Display today's usage"
covers: usage-tracking/spec.md > ADDED > per-model-breakdown > "Per-model breakdown"
covers: usage-tracking/spec.md > ADDED > per-agent-breakdown > "Per-agent breakdown"
covers: tasks.md > 4.4 > "Implement Usage API routes"
covers: tasks.md > 4.5 > "Create stores/usage.ts"

**Files:**

- Create: `dashboard/src/stores/usage.ts`
- Create: `dashboard/src/app/api/usage/route.ts`
- Create: `dashboard/src/app/api/usage/cost/route.ts`
- Create: `dashboard/src/app/api/usage/timeseries/route.ts`
- Create: `dashboard/server/__tests__/usage-api.test.ts`

**Gateway RPC methods used:**

- `usage.status` — NO params, returns provider usage summary (raw aggregate)
- `usage.cost` — params: `{ startDate?, endDate?, days?, mode?, utcOffset? }`, returns `CostUsageSummary`
- `sessions.usage` — returns per-session token usage
- `sessions.usage.timeseries` — returns time-bucketed usage data

> **Codex Review Fix:** `usage.status` takes no params. `usage.cost` uses `days`/date range, NOT a `window` string.

- [ ] **Step 1: Create usage store**

```typescript
// dashboard/src/stores/usage.ts
import { create } from "zustand";

export interface UsageSummary {
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  totalCost: number;
}

export interface ModelUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export interface AgentUsage {
  agentId: string;
  agentName: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export interface TimeseriesPoint {
  timestamp: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

interface UsageState {
  summary: UsageSummary | null;
  modelBreakdown: ModelUsage[];
  agentBreakdown: AgentUsage[];
  timeseries: TimeseriesPoint[];
  timeWindow: "today" | "7d" | "30d";
  loading: boolean;
  error: string | null;

  setTimeWindow: (window: "today" | "7d" | "30d") => void;
  fetchUsage: () => Promise<void>;
  fetchTimeseries: () => Promise<void>;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  summary: null,
  modelBreakdown: [],
  agentBreakdown: [],
  timeseries: [],
  timeWindow: "today",
  loading: false,
  error: null,

  setTimeWindow: (window) => {
    set({ timeWindow: window });
    void get().fetchUsage();
    void get().fetchTimeseries();
  },

  fetchUsage: async () => {
    set({ loading: true, error: null });
    try {
      const w = get().timeWindow;
      const [statusRes, costRes] = await Promise.all([
        fetch(`/api/usage`),
        fetch(`/api/usage/cost?days=${w === "today" ? 1 : w === "7d" ? 7 : 30}`),
      ]);
      if (!statusRes.ok || !costRes.ok) throw new Error("Failed to fetch usage");
      const status = await statusRes.json();
      const cost = await costRes.json();
      set({
        summary: {
          tokensIn: status.tokensIn ?? 0,
          tokensOut: status.tokensOut ?? 0,
          totalTokens: status.totalTokens ?? 0,
          totalCost: cost.totalCost ?? 0,
        },
        modelBreakdown: status.models ?? [],
        agentBreakdown: status.agents ?? [],
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error", loading: false });
    }
  },

  fetchTimeseries: async () => {
    try {
      const w = get().timeWindow;
      const days = w === "today" ? 1 : w === "7d" ? 7 : 30;
      const res = await fetch(`/api/usage/timeseries?days=${days}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ timeseries: Array.isArray(data) ? data : (data.points ?? []) });
    } catch {
      // timeseries is optional, don't error
    }
  },
}));
```

- [ ] **Step 2: Create usage API routes**

```typescript
// dashboard/src/app/api/usage/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async () => {
  // usage.status takes NO params — returns raw provider usage summary
  return gatewayRequest("usage.status", {});
});
```

```typescript
// dashboard/src/app/api/usage/cost/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async (request: NextRequest) => {
  // usage.cost params: { startDate?, endDate?, days?, mode?, utcOffset? }
  const days = request.nextUrl.searchParams.get("days") ?? "1";
  return gatewayRequest("usage.cost", { days: parseInt(days, 10) });
});
```

```typescript
// dashboard/src/app/api/usage/timeseries/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async (request: NextRequest) => {
  const days = request.nextUrl.searchParams.get("days") ?? "1";
  return gatewayRequest("sessions.usage.timeseries", { days: parseInt(days, 10) });
});
```

- [ ] **Step 3: Add i18n keys for usage**

Add to `zh.json` under `"usage"` key:

```json
"usage": {
  "title": "用量与费用",
  "today": "今天",
  "7d": "近 7 天",
  "30d": "近 30 天",
  "tokensIn": "输入 Token",
  "tokensOut": "输出 Token",
  "totalTokens": "总 Token",
  "totalCost": "总费用",
  "modelBreakdown": "按模型",
  "agentBreakdown": "按智能体",
  "noData": "暂无用量数据",
  "contextPressure": "上下文压力",
  "chart": "用量趋势"
}
```

Add matching English keys to `en.json`.

- [ ] **Step 4: Run tests and commit**

```bash
cd dashboard && pnpm test
git commit -m "[enhanced] [impl] feat(deck): add usage store and API routes"
```

---

### Task 4: Usage Panel Components [frontend]

covers: usage-tracking/spec.md > ADDED > token-consumption-aggregation > "Display 7-day and 30-day usage"
covers: usage-tracking/spec.md > ADDED > usage-charts > "Time-series chart rendering"
covers: usage-tracking/spec.md > ADDED > context-window-pressure > "Context pressure warning"
covers: tasks.md > 4.2 > "Implement Usage & Costs panel: today/7d/30d aggregation"
covers: tasks.md > 4.3 > "Implement Usage & Costs panel: charts (Recharts)"

**Files:**

- Create: `dashboard/src/components/panels/usage/UsagePanel.tsx`
- Create: `dashboard/src/components/panels/usage/SummaryCards.tsx`
- Create: `dashboard/src/components/panels/usage/BreakdownTable.tsx`
- Create: `dashboard/src/components/panels/usage/UsageChart.tsx`

**Skills:** frontend-design, superpowers:test-driven-development

- [ ] **Step 1: Create UsagePanel container**

```tsx
// dashboard/src/components/panels/usage/UsagePanel.tsx
"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useUsageStore } from "@/stores/usage";
import { SummaryCards } from "./SummaryCards";
import { BreakdownTable } from "./BreakdownTable";
import { UsageChart } from "./UsageChart";

export function UsagePanel() {
  const t = useTranslations("usage");
  const { timeWindow, setTimeWindow, fetchUsage, fetchTimeseries, loading } = useUsageStore();

  useEffect(() => {
    void fetchUsage();
    void fetchTimeseries();
  }, [fetchUsage, fetchTimeseries]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Time window selector */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: "var(--border)" }}
      >
        {(["today", "7d", "30d"] as const).map((w) => (
          <button
            key={w}
            onClick={() => setTimeWindow(w)}
            className="px-3 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: timeWindow === w ? "var(--accent)" : "var(--bg-secondary)",
              color: timeWindow === w ? "#fff" : "var(--text-secondary)",
            }}
          >
            {t(w)}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("noData")}
          </p>
        ) : (
          <>
            <SummaryCards />
            <UsageChart />
            <BreakdownTable />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SummaryCards**

4 cards showing tokensIn, tokensOut, totalTokens, totalCost. Use `token-pricing.ts` for formatting costs.

```tsx
// dashboard/src/components/panels/usage/SummaryCards.tsx
"use client";

import { useTranslations } from "next-intl";
import { useUsageStore } from "@/stores/usage";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function SummaryCards() {
  const t = useTranslations("usage");
  const { summary } = useUsageStore();
  if (!summary) return null;

  const cards = [
    { label: t("tokensIn"), value: formatNumber(summary.tokensIn) },
    { label: t("tokensOut"), value: formatNumber(summary.tokensOut) },
    { label: t("totalTokens"), value: formatNumber(summary.totalTokens) },
    { label: t("totalCost"), value: `$${summary.totalCost.toFixed(2)}` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg p-3"
          style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {card.label}
          </p>
          <p className="text-lg font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create BreakdownTable**

Two tabs: "Per Model" and "Per Agent". Sorted by tokens descending.

```tsx
// dashboard/src/components/panels/usage/BreakdownTable.tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useUsageStore } from "@/stores/usage";

export function BreakdownTable() {
  const t = useTranslations("usage");
  const { modelBreakdown, agentBreakdown } = useUsageStore();
  const [tab, setTab] = useState<"model" | "agent">("model");

  const rows =
    tab === "model"
      ? modelBreakdown.map((m) => ({
          name: m.model,
          tokensIn: m.tokensIn,
          tokensOut: m.tokensOut,
          cost: m.cost,
        }))
      : agentBreakdown.map((a) => ({
          name: a.agentName || a.agentId,
          tokensIn: a.tokensIn,
          tokensOut: a.tokensOut,
          cost: a.cost,
        }));

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setTab("model")}
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: tab === "model" ? "var(--accent)" : "transparent",
            color: tab === "model" ? "#fff" : "var(--text-secondary)",
          }}
        >
          {t("modelBreakdown")}
        </button>
        <button
          onClick={() => setTab("agent")}
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: tab === "agent" ? "var(--accent)" : "transparent",
            color: tab === "agent" ? "#fff" : "var(--text-secondary)",
          }}
        >
          {t("agentBreakdown")}
        </button>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: "var(--text-secondary)" }}>
            <th className="text-left py-1 font-medium">
              {tab === "model" ? t("modelBreakdown") : t("agentBreakdown")}
            </th>
            <th className="text-right py-1 font-medium">{t("tokensIn")}</th>
            <th className="text-right py-1 font-medium">{t("tokensOut")}</th>
            <th className="text-right py-1 font-medium">{t("totalCost")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="py-1.5 font-mono" style={{ color: "var(--text-primary)" }}>
                {row.name}
              </td>
              <td className="text-right py-1.5" style={{ color: "var(--text-secondary)" }}>
                {row.tokensIn.toLocaleString()}
              </td>
              <td className="text-right py-1.5" style={{ color: "var(--text-secondary)" }}>
                {row.tokensOut.toLocaleString()}
              </td>
              <td className="text-right py-1.5" style={{ color: "var(--text-primary)" }}>
                ${row.cost.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create UsageChart with Recharts**

```tsx
// dashboard/src/components/panels/usage/UsageChart.tsx
"use client";

import { useTranslations } from "next-intl";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useUsageStore } from "@/stores/usage";

export function UsageChart() {
  const t = useTranslations("usage");
  const { timeseries } = useUsageStore();

  if (timeseries.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
        {t("chart")}
      </h3>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <AreaChart data={timeseries}>
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              tickFormatter={(v: string) => new Date(v).toLocaleDateString()}
            />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="tokensIn"
              stackId="1"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.3}
              name={t("tokensIn")}
            />
            <Area
              type="monotone"
              dataKey="tokensOut"
              stackId="1"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.3}
              name={t("tokensOut")}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Register panel in NavRail and router**

Add "usage" to the panel router in `src/app/page.tsx` (or `[[...panel]]/page.tsx`). Ensure the NavRail item for "Usage" renders this panel.

- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): implement Usage & Costs panel with charts"
```

---

### Task 5: Context Window Pressure Indicator [frontend]

covers: usage-tracking/spec.md > ADDED > context-window-pressure > "Context pressure warning"

**Files:**

- Create: `dashboard/src/components/panels/usage/ContextPressure.tsx`
- Modify: `dashboard/src/components/panels/usage/UsagePanel.tsx` (add ContextPressure)

- [ ] **Step 1: Create ContextPressure component**

Shows per-session context window usage as colored progress bars (green <60%, yellow 60-80%, red >80%).

```tsx
// dashboard/src/components/panels/usage/ContextPressure.tsx
"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface SessionPressure {
  sessionKey: string;
  model: string;
  tokensUsed: number;
  contextWindow: number;
}

function pressureColor(pct: number): string {
  if (pct >= 80) return "var(--status-disconnected)";
  if (pct >= 60) return "#eab308";
  return "#22c55e";
}

export function ContextPressure() {
  const t = useTranslations("usage");
  const [sessions, setSessions] = useState<SessionPressure[]>([]);

  useEffect(() => {
    void fetch("/api/usage?detail=sessions")
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data.sessions) ? data.sessions : [];
        setSessions(items.filter((s: SessionPressure) => s.contextWindow > 0));
      })
      .catch(() => {});
  }, []);

  if (sessions.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
        {t("contextPressure")}
      </h3>
      <div className="space-y-2">
        {sessions.slice(0, 5).map((s) => {
          const pct = Math.min(100, (s.tokensUsed / s.contextWindow) * 100);
          return (
            <div key={s.sessionKey} className="text-xs">
              <div
                className="flex justify-between mb-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="font-mono truncate max-w-[200px]">{s.sessionKey}</span>
                <span>{pct.toFixed(0)}%</span>
              </div>
              <div
                className="h-1.5 rounded-full"
                style={{ backgroundColor: "var(--bg-secondary)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: pressureColor(pct) }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to UsagePanel and commit**

---

## Chunk 3: Sessions + Logs Panels (Tasks 6–9)

### Task 6: Sessions Store + API Routes [backend]

covers: session-browser/spec.md > ADDED > session-list-display > "List sessions with kind badges"
covers: session-browser/spec.md > ADDED > token-statistics > "Token stats display"
covers: tasks.md > 4.6 > "Implement Sessions panel: session list with kind badges"
covers: tasks.md > 4.8 > "Implement Sessions API routes"

**Files:**

- Create: `dashboard/src/stores/sessions.ts`
- Create: `dashboard/src/app/api/sessions/route.ts` (was in P0 under chat/sessions — extract as dedicated)
- Create: `dashboard/src/app/api/sessions/[sessionKey]/route.ts`

**Gateway RPC:** `sessions.list`, `chat.history`

- [ ] **Step 1: Create sessions store**

```typescript
// dashboard/src/stores/sessions.ts
import { create } from "zustand";

export interface SessionInfo {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  model: string;
  tokensIn: number;
  tokensOut: number;
  contextWindow: number;
  updatedAt: string;
}

interface SessionsState {
  sessions: SessionInfo[];
  selectedKey: string | null;
  history: unknown[];
  loading: boolean;
  error: string | null;

  fetchSessions: () => Promise<void>;
  selectSession: (key: string | null) => void;
  fetchHistory: (sessionKey: string) => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  selectedKey: null,
  history: [],
  loading: false,
  error: null,

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      set({ sessions: Array.isArray(data) ? data : (data.sessions ?? []), loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error", loading: false });
    }
  },

  selectSession: (key) => {
    set({ selectedKey: key, history: [] });
    if (key) void get().fetchHistory(key);
  },

  fetchHistory: async (sessionKey) => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ history: Array.isArray(data) ? data : (data.messages ?? []) });
    } catch {
      // silent
    }
  },

  deleteSession: async (sessionKey) => {
    await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}`, { method: "DELETE" });
    set((state) => ({
      sessions: state.sessions.filter((s) => s.key !== sessionKey),
      ...(state.selectedKey === sessionKey ? { selectedKey: null, history: [] } : {}),
    }));
  },
}));
```

- [ ] **Step 2: Create sessions API routes**

```typescript
// dashboard/src/app/api/sessions/route.ts
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async () => {
  return gatewayRequest("sessions.list", {});
});
```

```typescript
// dashboard/src/app/api/sessions/[sessionKey]/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(
  async (_request: NextRequest, { params }: { params: Promise<{ sessionKey: string }> }) => {
    const { sessionKey } = await params;
    return gatewayRequest("chat.history", { sessionKey });
  },
);

export const DELETE = withAuth(
  async (_request: NextRequest, { params }: { params: Promise<{ sessionKey: string }> }) => {
    const { sessionKey } = await params;
    return gatewayRequest("sessions.delete", { key: sessionKey });
  },
);
```

- [ ] **Step 3: Add i18n keys and commit**

Add `"sessions"` namespace to both `zh.json` and `en.json`:

```json
"sessions": {
  "title": "会话浏览器",
  "kind": "类型",
  "direct": "直接",
  "group": "群组",
  "global": "全局",
  "unknown": "未知",
  "tokensIn": "输入 Token",
  "tokensOut": "输出 Token",
  "context": "上下文用量",
  "history": "对话记录",
  "noSessions": "暂无会话",
  "model": "模型",
  "updatedAt": "更新于",
  "confirmDelete": "确定删除该会话？"
}
```

---

### Task 7: Sessions Panel Components [frontend]

covers: session-browser/spec.md > ADDED > context-usage-visualization > "Context bar rendering"
covers: session-browser/spec.md > ADDED > conversation-history-viewer > "View session history"
covers: tasks.md > 4.7 > "Implement Sessions panel: token stats, conversation history viewer"

**Files:**

- Create: `dashboard/src/components/panels/sessions/SessionsPanel.tsx`
- Create: `dashboard/src/components/panels/sessions/SessionList.tsx`
- Create: `dashboard/src/components/panels/sessions/SessionDetail.tsx`

**Skills:** frontend-design, superpowers:test-driven-development

- [ ] **Step 1: Create SessionList**

Sidebar list with kind badges (colored chips: direct=blue, group=green, global=purple, unknown=gray), context bar, truncated session key.

- [ ] **Step 2: Create SessionDetail**

Header with session key + model + updatedAt, context usage bar (green/yellow/red), token stats table, conversation history viewer (reuse MessageBubble pattern from Chat panel).

- [ ] **Step 3: Create SessionsPanel**

Split layout: left sidebar (SessionList 30%) + right detail (SessionDetail 70%).

- [ ] **Step 4: Register in router and commit**

---

### Task 8: Logs Store + API Routes [backend]

covers: log-viewer/spec.md > ADDED > real-time-log-streaming > "Stream logs in real-time"
covers: log-viewer/spec.md > ADDED > level-filter > "Filter by log level"
covers: tasks.md > 4.14 > "Implement Logs panel: real-time streaming via logs.tail"
covers: tasks.md > 4.15 > "Implement Logs API routes"

**Files:**

- Create: `dashboard/src/stores/logs.ts`
- Create: `dashboard/src/app/api/logs/route.ts`

**Gateway RPC:** `logs.tail` — params: `{ cursor?, limit?, maxBytes? }`, returns `{ file, cursor, size, lines[], truncated?, reset? }`

**Important design note:** `logs.tail` is a **cursor-based polling RPC**. It does NOT support level/source/session filtering — those filters must be applied on the Deck Server side after fetching raw log lines. The server polls at 2s intervals, parses log lines, applies filters, and broadcasts filtered entries via `eventBus.broadcast("log.entry", ...)`.

> **Codex Review Fix:** `logs.tail` only accepts `cursor/limit/maxBytes`. Level/source/session filtering is done Deck Server-side by parsing log line format.

- [ ] **Step 1: Create logs store**

```typescript
// dashboard/src/stores/logs.ts
import { create } from "zustand";

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
  sessionKey?: string;
}

interface LogsState {
  entries: LogEntry[];
  filters: {
    level: string[];
    source: string | null;
    sessionKey: string | null;
  };
  streaming: boolean;
  maxEntries: number;

  addEntries: (entries: LogEntry[]) => void;
  setLevelFilter: (levels: string[]) => void;
  setSourceFilter: (source: string | null) => void;
  setSessionFilter: (sessionKey: string | null) => void;
  clearLogs: () => void;
  setStreaming: (streaming: boolean) => void;
}

export const useLogsStore = create<LogsState>((set) => ({
  entries: [],
  filters: { level: [], source: null, sessionKey: null },
  streaming: true,
  maxEntries: 500,

  addEntries: (newEntries) =>
    set((state) => {
      const combined = [...state.entries, ...newEntries];
      return { entries: combined.slice(-state.maxEntries) };
    }),

  setLevelFilter: (levels) => set((state) => ({ filters: { ...state.filters, level: levels } })),
  setSourceFilter: (source) => set((state) => ({ filters: { ...state.filters, source } })),
  setSessionFilter: (sessionKey) => set((state) => ({ filters: { ...state.filters, sessionKey } })),
  clearLogs: () => set({ entries: [] }),
  setStreaming: (streaming) => set({ streaming }),
}));
```

- [ ] **Step 2: Create logs API route**

```typescript
// dashboard/src/app/api/logs/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async (request: NextRequest) => {
  // logs.tail only supports cursor/limit/maxBytes — NO level/source/session filters
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = request.nextUrl.searchParams.get("limit") ?? "500";

  return gatewayRequest("logs.tail", {
    ...(cursor ? { cursor: parseInt(cursor, 10) } : {}),
    limit: parseInt(limit, 10),
  });
});
```

> **Note:** Level/source/session filtering is done on the Deck Server side. The server-side log poller (in `runtime.ts`) parses each raw log line into structured `LogEntry` objects, applies filters, then broadcasts via EventBus. The frontend receives pre-filtered entries via SSE.

- [ ] **Step 3: Implement SSE log forwarding**

In `server/runtime.ts`, add a polling timer that calls `logs.tail` every 2s when the adapter is connected, and broadcasts new entries via `eventBus.broadcast("log.entry", entry)`. This enables the SSE stream to forward logs to the browser in real-time.

- [ ] **Step 4: Add i18n keys and commit**

Add `"logs"` namespace:

```json
"logs": {
  "title": "日志查看器",
  "level": "级别",
  "source": "来源",
  "session": "会话",
  "debug": "调试",
  "info": "信息",
  "warn": "警告",
  "error": "错误",
  "gateway": "网关",
  "agent": "智能体",
  "channel": "渠道",
  "clear": "清空",
  "pause": "暂停",
  "resume": "恢复",
  "noLogs": "暂无日志"
}
```

---

### Task 9: Logs Panel Components [frontend]

covers: log-viewer/spec.md > ADDED > log-entry-format > "Log entry format"
covers: log-viewer/spec.md > ADDED > source-filter > "Filter by source"
covers: log-viewer/spec.md > ADDED > session-filter > "Filter by session"
covers: tasks.md > 4.14 > "Implement Logs panel: level/source/session filters"

**Files:**

- Create: `dashboard/src/components/panels/logs/LogsPanel.tsx`
- Create: `dashboard/src/components/panels/logs/LogStream.tsx`
- Create: `dashboard/src/components/panels/logs/LogFilters.tsx`
- Create: `dashboard/src/components/panels/logs/useLogSSE.ts`

**Skills:** frontend-design, superpowers:test-driven-development

- [ ] **Step 1: Create useLogSSE hook**

Listens for `log.entry` events on SSE stream (reuse existing `/api/stream` SSE endpoint). Adds entries to logs store.

- [ ] **Step 2: Create LogFilters**

Dropdowns for level (multi-select: debug/info/warn/error), source (gateway/agent/channel), session ID text input. All connected to logs store filters.

- [ ] **Step 3: Create LogStream**

Auto-scrolling log output with color-coded level badges (debug=gray, info=blue, warn=yellow, error=red). Each entry shows: `[timestamp] [level] [source] message`. Monospace font.

- [ ] **Step 4: Create LogsPanel**

Toolbar (filters + clear/pause buttons) + LogStream. Pause/resume toggles `streaming` state.

- [ ] **Step 5: Register and commit**

---

## Chunk 4: Memory Browser + Activity Feed (Tasks 10–13)

### Task 10: Memory Store + API Routes [backend]

covers: memory-browser/spec.md > ADDED > memory-file-tree > "Display memory file tree (LanceDB enabled)"
covers: memory-browser/spec.md > ADDED > memory-file-tree > "Display memory file tree (file-based fallback)"
covers: memory-browser/spec.md > ADDED > memory-health > "Display health diagnostics"
covers: tasks.md > 4.9 > "Implement Memory Browser panel: file tree browser"
covers: tasks.md > 4.12 > "Implement Memory API routes"

**Files:**

- Create: `dashboard/src/stores/memory.ts`
- Create: `dashboard/src/app/api/memory/route.ts`
- Create: `dashboard/src/app/api/memory/browse/route.ts`
- Create: `dashboard/src/app/api/memory/search/route.ts`
- Create: `dashboard/src/app/api/memory/health/route.ts`

**Gateway RPC:** `doctor.memory.status`

**Important design note:** Memory browsing does NOT go through Gateway RPC. The Deck Server must:

1. Call `config.get` to detect if `memory-lancedb` extension is enabled
2. If enabled, read the extension config to dynamically resolve the LanceDB data path (do NOT hardcode `~/.openclaw/agents/*/memory/`)
3. If not enabled, fall back to memory-core file browsing from the config-derived path
4. **Path traversal protection:** All file paths must be validated to stay within the resolved memory directory (use `path.resolve()` + prefix check). Reject paths containing `..` or absolute paths.
5. Only health diagnostics uses `doctor.memory.status` RPC.

> **Codex Review Fix:** Path must be dynamically resolved from config, not hardcoded. Add path traversal protection.

- [ ] **Step 1: Create memory store**

State: `agents[]` (memory-enabled agents), `files[]` (file tree), `selectedFile` (content), `searchResults[]`, `healthStatus[]`, `isLanceDbEnabled`.

- [ ] **Step 2: Create memory API routes**

- `GET /api/memory/browse?agentId=&path=` — read file tree from `~/.openclaw/agents/{agentId}/memory/`
- `GET /api/memory/search?query=&agentId=` — if LanceDB enabled, run vector search
- `GET /api/memory/health` — call `doctor.memory.status` RPC

For the browse route, use Node.js `fs.readdir` to list files. For search, check if `memory-lancedb` is enabled via `config.get`.

- [ ] **Step 3: Add i18n keys and commit**

Add `"memory"` namespace:

```json
"memory": {
  "title": "记忆浏览器",
  "fileTree": "文件树",
  "search": "向量搜索",
  "health": "健康诊断",
  "agent": "智能体",
  "noFiles": "暂无记忆文件",
  "noResults": "无搜索结果",
  "searchPlaceholder": "搜索记忆...",
  "lancedbEnabled": "LanceDB 已启用",
  "lancedbDisabled": "LanceDB 未启用（仅文件浏览）",
  "relevance": "相关度",
  "content": "内容"
}
```

---

### Task 11: Memory Browser Panel Components [frontend]

covers: memory-browser/spec.md > ADDED > vector-search > "Execute vector search"
covers: memory-browser/spec.md > ADDED > knowledge-graph > "Display knowledge graph"
covers: memory-browser/spec.md > ADDED > memory-file-tree > "View memory file content"
covers: tasks.md > 4.10 > "Implement Memory Browser panel: vector search"
covers: tasks.md > 4.11 > "Implement Memory Browser panel: knowledge graph"

**Files:**

- Create: `dashboard/src/components/panels/memory/MemoryPanel.tsx`
- Create: `dashboard/src/components/panels/memory/FileTree.tsx`
- Create: `dashboard/src/components/panels/memory/SearchPanel.tsx`
- Create: `dashboard/src/components/panels/memory/HealthDiagnostics.tsx`

**Skills:** frontend-design, superpowers:test-driven-development

- [ ] **Step 1: Create FileTree**

Hierarchical expandable tree with folder/file icons. Click file to display content in read-only viewer.

- [ ] **Step 2: Create SearchPanel**

Search input + results list with relevance scores. Disabled state when LanceDB not enabled (show "lancedbDisabled" message).

- [ ] **Step 3: Create HealthDiagnostics**

Table showing per-agent memory health: agent ID, provider, embedding status (ok/error), error details.

- [ ] **Step 4: Create MemoryPanel**

Tabs: File Tree | Search | Graph | Health. Agent selector dropdown at top.

> **Codex Review Fix:** Knowledge graph is ADDED in spec — cannot defer. Implement a basic node-link visualization using SVG or a lightweight library (e.g., force-directed layout with `d3-force` or pure SVG). Nodes = memory entries, edges = links between related memories. Can be simplified to a list-based "related memories" view if graph rendering is too complex for this phase.

- [ ] **Step 5: Register and commit**

---

### Task 12: Activity Store + API Routes [backend]

covers: activity-feed/spec.md > ADDED > chronological-event-timeline > "Display event timeline"
covers: activity-feed/spec.md > ADDED > chronological-event-timeline > "Real-time event arrival"
covers: tasks.md > 4.17 > "Implement Activity Feed panel"
covers: tasks.md > 4.19 > "Implement Activity API routes"

**Files:**

- Create: `dashboard/src/stores/activity.ts`
- Create: `dashboard/src/app/api/activity/route.ts`

**Data source:** Activity events come from the EventBus (Gateway events forwarded through WS → EventBus → SSE). The API route returns recent events from the EventBus replay buffer + projection store.

> **Codex Review Fix:** The projection store's `appendEvent()` exists but nothing currently populates it with Gateway events. This task MUST add an event bridge in `runtime.ts` that subscribes to Gateway WS events (agent lifecycle, tool calls, chat completions) and calls `store.appendEvent()` to persist them. Without this, the Activity API returns empty history.

- [ ] **Step 1: Create activity store**

```typescript
// dashboard/src/stores/activity.ts
import { create } from "zustand";

export interface ActivityEvent {
  id: number;
  timestamp: number;
  type: "tool_call" | "chat" | "status" | "agent" | "system";
  agentId?: string;
  agentName?: string;
  description: string;
  details?: unknown;
}

interface ActivityState {
  events: ActivityEvent[];
  filters: {
    agentId: string | null;
    eventType: string | null;
  };
  loading: boolean;

  addEvent: (event: ActivityEvent) => void;
  addEvents: (events: ActivityEvent[]) => void;
  setAgentFilter: (agentId: string | null) => void;
  setTypeFilter: (type: string | null) => void;
  fetchRecent: () => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  filters: { agentId: null, eventType: null },
  loading: false,

  addEvent: (event) => set((state) => ({ events: [event, ...state.events].slice(0, 200) })),

  addEvents: (events) => set((state) => ({ events: [...events, ...state.events].slice(0, 200) })),

  setAgentFilter: (agentId) => set((state) => ({ filters: { ...state.filters, agentId } })),
  setTypeFilter: (type) => set((state) => ({ filters: { ...state.filters, eventType: type } })),

  fetchRecent: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/activity");
      if (!res.ok) return;
      const data = await res.json();
      set({ events: Array.isArray(data) ? data : (data.events ?? []), loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
```

- [ ] **Step 2: Create activity API route**

Returns recent events from projection store's outbox table, ordered by timestamp DESC, limit 100.

```typescript
// dashboard/src/app/api/activity/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { getDeckRuntime } from "@server/runtime.js";

export const GET = withAuth(async (request: NextRequest) => {
  const runtime = getDeckRuntime();
  if (!runtime) {
    return Response.json({ error: "Runtime not ready" }, { status: 503 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10);
  const events = runtime.store.getEventsSince(0).slice(-limit).reverse();
  return Response.json(events);
});
```

- [ ] **Step 3: Add i18n keys and commit**

Add `"activity"` namespace:

```json
"activity": {
  "title": "动态信息流",
  "allAgents": "全部智能体",
  "allTypes": "全部类型",
  "toolCall": "工具调用",
  "chatMessage": "对话消息",
  "statusChange": "状态变化",
  "noEvents": "暂无动态",
  "agent": "智能体",
  "type": "类型",
  "time": "时间"
}
```

---

### Task 13: Activity Feed Panel Components [frontend]

covers: activity-feed/spec.md > ADDED > agent-event-display > "Tool call event"
covers: activity-feed/spec.md > ADDED > agent-event-display > "Agent status change"
covers: activity-feed/spec.md > ADDED > event-filtering > "Filter by agent"
covers: activity-feed/spec.md > ADDED > event-filtering > "Filter by event type"
covers: tasks.md > 4.18 > "Implement Activity Feed panel: filterable by agent/event type"

**Files:**

- Create: `dashboard/src/components/panels/activity/ActivityPanel.tsx`
- Create: `dashboard/src/components/panels/activity/EventTimeline.tsx`
- Create: `dashboard/src/components/panels/activity/useActivitySSE.ts`

**Skills:** frontend-design, superpowers:test-driven-development

- [ ] **Step 1: Create useActivitySSE hook**

Listen for `activity.event` and `agent` event types on SSE. Transform Gateway events into `ActivityEvent` format and add to store.

- [ ] **Step 2: Create EventTimeline**

Reverse-chronological list. Each entry: timestamp (relative, e.g. "2m ago"), event type icon, agent name, description. Tool calls show tool name + args preview. Status changes show old→new state.

- [ ] **Step 3: Create ActivityPanel**

Filter toolbar (agent dropdown + type dropdown) + EventTimeline. Auto-refresh on SSE events.

- [ ] **Step 4: Register and commit**

---

## Chunk 5: Channels + Config Editor (Tasks 14–18)

### Task 14: Channels Store + API Routes [backend]

covers: channel-configuration/spec.md > ADDED > channel-list-display > "Display configured and available channels"
covers: channel-configuration/spec.md > ADDED > channel-status > "Channel status display"
covers: tasks.md > 5.3 > "Implement Channels API routes"

**Files:**

- Create: `dashboard/src/stores/channels.ts`
- Create: `dashboard/src/app/api/channels/route.ts`
- Create: `dashboard/src/app/api/channels/[channelId]/route.ts`

**Gateway RPC:** `channels.status`, `config.patch`, `config.set`, `channels.logout`

- [ ] **Step 1: Create channels store**

```typescript
// dashboard/src/stores/channels.ts
import { create } from "zustand";

export interface ChannelInfo {
  id: string;
  type: string; // telegram, discord, slack, whatsapp, signal, etc.
  status: "linked" | "error" | "unconfigured";
  error?: string;
  config?: Record<string, unknown>;
}

interface ChannelsState {
  configured: ChannelInfo[];
  available: string[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;

  fetchChannels: () => Promise<void>;
  selectChannel: (id: string | null) => void;
  updateConfig: (channelId: string, config: Record<string, unknown>) => Promise<void>;
  logoutChannel: (channelId: string) => Promise<void>;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  configured: [],
  available: [],
  selectedId: null,
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/channels");
      if (!res.ok) throw new Error("Failed to fetch channels");
      const data = await res.json();
      set({
        configured: data.configured ?? [],
        available: data.available ?? [],
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error", loading: false });
    }
  },

  selectChannel: (id) => set({ selectedId: id }),

  updateConfig: async (channelId, config) => {
    const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) void get().fetchChannels();
  },

  logoutChannel: async (channelId) => {
    await fetch(`/api/channels/${encodeURIComponent(channelId)}/logout`, { method: "POST" });
    void get().fetchChannels();
  },
}));
```

- [ ] **Step 2: Create channels API routes**

```typescript
// dashboard/src/app/api/channels/route.ts
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async () => {
  return gatewayRequest("channels.status", {});
});
```

```typescript
// dashboard/src/app/api/channels/[channelId]/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const PATCH = withAuth(
  async (request: NextRequest, { params }: { params: Promise<{ channelId: string }> }) => {
    const { channelId } = await params;
    const body = await request.json();
    // config.patch requires { raw, baseHash? } — raw is JSON5 string of the patch
    // First get current config to obtain baseHash, then apply channel-specific patch
    const configRes = await gatewayRequest("config.get", {});
    const configData = await configRes.json();
    const currentConfig = configData.config ?? {};
    // Merge channel config into current config
    const channels = currentConfig.channels ?? {};
    channels[channelId] = { ...channels[channelId], ...body };
    const patched = { ...currentConfig, channels };
    return gatewayRequest("config.patch", {
      raw: JSON.stringify(patched, null, 2),
      baseHash: configData.baseHash,
    });
  },
);
```

Also create `channels/[channelId]/logout/route.ts` calling `channels.logout`.

- [ ] **Step 3: Add i18n keys and commit**

Add `"channels"` namespace:

```json
"channels": {
  "title": "渠道管理",
  "configured": "已配置",
  "available": "可用渠道",
  "linked": "已连接",
  "error": "异常",
  "unconfigured": "未配置",
  "token": "Token",
  "webhookUrl": "Webhook URL",
  "phoneNumber": "手机号",
  "enable": "启用",
  "disable": "禁用",
  "relink": "重新连接",
  "logout": "断开连接",
  "noChannels": "未配置任何渠道",
  "saveConfig": "保存配置",
  "confirmLogout": "确定断开该渠道？"
}
```

---

### Task 15: Channels Panel Components [frontend]

covers: channel-configuration/spec.md > ADDED > channel-config-forms > "Configure channel credentials"
covers: channel-configuration/spec.md > ADDED > channel-enable-disable > "Disable a channel"
covers: channel-configuration/spec.md > ADDED > channel-enable-disable > "Re-link errored channel"
covers: tasks.md > 5.1 > "Implement Channels panel: configured vs available channel list"
covers: tasks.md > 5.2 > "Implement Channels panel: per-channel status, config forms"

**Files:**

- Create: `dashboard/src/components/panels/channels/ChannelsPanel.tsx`
- Create: `dashboard/src/components/panels/channels/ChannelList.tsx`
- Create: `dashboard/src/components/panels/channels/ChannelConfig.tsx`

**Skills:** frontend-design, superpowers:test-driven-development

- [ ] **Step 1: Create ChannelList**

Split into "Configured" and "Available" sections. Each channel shows: type icon, name, status badge (green=linked, red=error, gray=unconfigured).

- [ ] **Step 2: Create ChannelConfig**

Per-channel form: fields depend on channel type (Telegram=token, Discord=token, Slack=token+webhook, WhatsApp=phone, etc.). Enable/disable toggle. Re-link button for errored channels. Logout button.

- [ ] **Step 3: Create ChannelsPanel**

Sidebar list (30%) + config form (70%). On select, show ChannelConfig for the selected channel.

- [ ] **Step 4: Register and commit**

---

### Task 16: Config Store + API Routes [backend]

covers: config-editor/spec.md > ADDED > schema-driven-form > "Generate form from schema"
covers: config-editor/spec.md > ADDED > save-and-reload > "Save configuration changes"
covers: config-editor/spec.md > ADDED > save-and-reload > "Save conflict detection"
covers: tasks.md > 5.7 > "Implement Config API routes"

**Files:**

- Create: `dashboard/src/stores/config.ts`
- Create: `dashboard/src/app/api/config/route.ts`
- Create: `dashboard/src/app/api/config/schema/route.ts`
- Create: `dashboard/src/app/api/config/apply/route.ts`

**Gateway RPC:**

- `config.get` — NO params, returns `{ config, baseHash, valid, exists }`
- `config.schema` — returns JSON Schema
- `config.apply` — params: `{ raw, baseHash?, sessionKey?, note? }`, returns `{ ok, path, config, restart, sentinel }`. Conflict = `INVALID_REQUEST` error (not a special code).

> **Codex Review Fix:** `config.get` returns `baseHash` in response (use it for concurrency). Conflict error code is `INVALID_REQUEST`, not `CONFLICT`.

- [ ] **Step 1: Create config store**

```typescript
// dashboard/src/stores/config.ts
import { create } from "zustand";

interface ConfigState {
  schema: Record<string, unknown> | null;
  rawConfig: string;
  baseHash: string;
  editedConfig: string;
  isDirty: boolean;
  saving: boolean;
  conflict: boolean;
  loading: boolean;
  error: string | null;
  activeSection: string;

  fetchSchema: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  setEditedConfig: (value: string) => void;
  setActiveSection: (section: string) => void;
  saveConfig: () => Promise<boolean>;
  reloadConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  schema: null,
  rawConfig: "",
  baseHash: "",
  editedConfig: "",
  isDirty: false,
  saving: false,
  conflict: false,
  loading: false,
  error: null,
  activeSection: "gateway",

  fetchSchema: async () => {
    try {
      const res = await fetch("/api/config/schema");
      if (!res.ok) return;
      const data = await res.json();
      set({ schema: data });
    } catch {
      // silent
    }
  },

  fetchConfig: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      // config.get returns { config, baseHash, valid, exists }
      const raw = typeof data.config === "object" ? JSON.stringify(data.config, null, 2) : "";
      const hash = data.baseHash ?? "";
      set({
        rawConfig: raw,
        baseHash: hash,
        editedConfig: raw,
        isDirty: false,
        conflict: false,
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown", loading: false });
    }
  },

  setEditedConfig: (value) =>
    set((state) => ({ editedConfig: value, isDirty: value !== state.rawConfig })),
  setActiveSection: (section) => set({ activeSection: section }),

  saveConfig: async () => {
    set({ saving: true, conflict: false });
    try {
      const res = await fetch("/api/config/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: get().editedConfig, baseHash: get().baseHash }),
      });
      if (!res.ok) {
        const data = await res.json();
        // Gateway returns INVALID_REQUEST on baseHash mismatch (not a special CONFLICT code)
        if (data.code === "INVALID_REQUEST" && data.error?.includes("config changed")) {
          set({ conflict: true, saving: false });
          return false;
        }
        throw new Error(data.error || "Save failed");
      }
      // Reload after save
      await get().reloadConfig();
      set({ saving: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown", saving: false });
      return false;
    }
  },

  reloadConfig: async () => {
    await get().fetchConfig();
  },
}));
```

- [ ] **Step 2: Create config API routes**

```typescript
// dashboard/src/app/api/config/route.ts — GET (fetch current config)
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async () => {
  return gatewayRequest("config.get", {});
});
```

```typescript
// dashboard/src/app/api/config/schema/route.ts — GET (fetch JSON schema)
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const GET = withAuth(async () => {
  return gatewayRequest("config.schema", {});
});
```

```typescript
// dashboard/src/app/api/config/apply/route.ts — POST (save with concurrency control)
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth.js";
import { gatewayRequest } from "@/lib/api-helpers.js";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { raw: string; baseHash: string };
  if (!body.raw) {
    return Response.json({ error: "raw config is required" }, { status: 400 });
  }
  return gatewayRequest("config.apply", { raw: body.raw, baseHash: body.baseHash });
});
```

- [ ] **Step 3: Add i18n keys and commit**

Add `"config"` namespace:

```json
"config": {
  "title": "配置编辑器",
  "schema": "配置结构",
  "save": "保存",
  "reload": "重新加载",
  "saving": "保存中...",
  "saved": "已保存",
  "conflict": "检测到冲突，请重新加载后再编辑",
  "unsavedChanges": "有未保存的更改",
  "confirmLeave": "确定离开？未保存的更改将丢失",
  "section": "配置节",
  "gateway": "网关",
  "agents": "智能体",
  "hooks": "钩子",
  "models": "模型",
  "channels": "渠道",
  "advanced": "高级"
}
```

---

### Task 17: Config Editor Schema Parser [frontend]

covers: config-editor/spec.md > ADDED > schema-driven-form > "Handle nested schema objects"
covers: config-editor/spec.md > ADDED > section-navigation > "Navigate to section"
covers: tasks.md > 5.4 > "Implement Config Editor: fetch schema via config.schema RPC"
covers: tasks.md > 5.5 > "Implement Config Editor: section navigation, form rendering"

**Files:**

- Create: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`
- Create: `dashboard/src/components/panels/config-editor/SchemaForm.tsx`
- Create: `dashboard/src/components/panels/config-editor/SectionNav.tsx`
- Create: `dashboard/src/lib/schema-parser.ts`
- Create: `dashboard/src/lib/schema-parser.test.ts`

**Skills:** frontend-design, superpowers:test-driven-development

- [ ] **Step 1: Write schema-parser tests**

The schema parser converts JSON Schema sections into renderable form fields:

```typescript
// dashboard/src/lib/schema-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseSchemaSection } from "./schema-parser.js";

describe("parseSchemaSection", () => {
  it("parses string property", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent name" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0].key).toBe("name");
    expect(fields[0].type).toBe("string");
  });

  it("parses boolean property", () => {
    const schema = {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("boolean");
  });

  it("parses nested object", () => {
    const schema = {
      type: "object",
      properties: {
        gateway: {
          type: "object",
          properties: {
            port: { type: "number" },
          },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("object");
    expect(fields[0].children).toHaveLength(1);
  });

  it("parses enum as select", () => {
    const schema = {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["local", "remote"] },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("enum");
    expect(fields[0].options).toEqual(["local", "remote"]);
  });
});
```

- [ ] **Step 2: Implement schema-parser.ts**

```typescript
// dashboard/src/lib/schema-parser.ts
export interface FormField {
  key: string;
  type: "string" | "number" | "boolean" | "enum" | "array" | "object";
  description?: string;
  defaultValue?: unknown;
  options?: string[];
  children?: FormField[];
  required?: boolean;
}

export function parseSchemaSection(schema: Record<string, unknown>): FormField[] {
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);

  return Object.entries(properties).map(([key, prop]) => {
    const field: FormField = {
      key,
      type: mapType(prop),
      description: prop.description as string | undefined,
      defaultValue: prop.default,
      required: required.has(key),
    };

    if (Array.isArray(prop.enum)) {
      field.type = "enum";
      field.options = prop.enum as string[];
    }

    if (prop.type === "object" && prop.properties) {
      field.children = parseSchemaSection(prop as Record<string, unknown>);
    }

    return field;
  });
}

function mapType(prop: Record<string, unknown>): FormField["type"] {
  switch (prop.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "string";
  }
}
```

- [ ] **Step 3: Create SchemaForm component**

Renders form fields based on parsed schema. String → text input, boolean → toggle, enum → select, number → number input, object → collapsible section with nested fields.

- [ ] **Step 4: Create SectionNav**

Sidebar with section links (gateway, agents, hooks, models, channels, advanced). Clicking scrolls to or switches to that section.

- [ ] **Step 5: Create ConfigPanel**

Split layout: SectionNav (left 20%) + SchemaForm (right 80%). Top toolbar with Save and Reload buttons. Shows "unsaved changes" indicator when dirty.

- [ ] **Step 6: Run tests and commit**

---

### Task 18: Config Editor Save/Reload/Conflict [frontend]

covers: config-editor/spec.md > ADDED > save-and-reload > "Reload configuration"
covers: config-editor/spec.md > ADDED > dirty-state > "Dirty state indicator"
covers: config-editor/spec.md > ADDED > dirty-state > "Navigation guard"
covers: tasks.md > 5.6 > "Implement Config Editor: save with baseHash concurrency control"

**Files:**

- Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`
- Create: `dashboard/src/components/panels/config-editor/ConflictDialog.tsx`

**Skills:** frontend-design

- [ ] **Step 1: Implement save flow**

On save: call `saveConfig()` from store. If `conflict: true`, show ConflictDialog with option to reload + re-apply or discard.

- [ ] **Step 2: Create ConflictDialog**

Modal showing "Config has been modified by another process. Reload?" with Reload and Cancel buttons.

- [ ] **Step 3: Implement navigation guard**

When `isDirty` is true, intercept navigation (via `beforeunload` event + custom panel switch guard) to warn user about unsaved changes.

- [ ] **Step 4: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): implement Config Editor with schema parsing and conflict detection"
```

---

## Chunk 6: Integration + i18n + Panel Registration (Task 19)

### Task 19: Panel Registration + i18n Completion + Full Integration [infra]

covers: All P1 panels

**Files:**

- Modify: `dashboard/src/app/page.tsx` (or `[[...panel]]/page.tsx` — register all 7 new panels)
- Modify: `dashboard/src/components/layout/NavRail.tsx` (if panel entries need updating)
- Modify: `dashboard/src/i18n/zh.json` (complete all P1 namespaces)
- Modify: `dashboard/src/i18n/en.json` (complete all P1 namespaces)
- Modify: `dashboard/server/event-bus.ts` (verify P1 event types)

- [ ] **Step 1: Register all 7 panels in the router**

Ensure the main page component's panel switch/router includes:

- `usage` → `<UsagePanel />`
- `sessions` → `<SessionsPanel />`
- `memory` → `<MemoryPanel />`
- `logs` → `<LogsPanel />`
- `activity` → `<ActivityPanel />`
- `channels` → `<ChannelsPanel />`
- `config` → `<ConfigPanel />`

- [ ] **Step 2: Verify all i18n keys exist in both zh.json and en.json**

Cross-check every `useTranslations()` call in P1 components against the i18n files. All keys must exist in both languages.

- [ ] **Step 3: Verify SSE event flow**

Confirm that:

- `log.entry` events from the logs polling are delivered via SSE to `useLogSSE` hook
- `activity.event` events reach `useActivitySSE` hook
- Existing P0 events (chat, agent) still work

- [ ] **Step 4: Run full test suite**

```bash
cd dashboard && pnpm test
```

- [ ] **Step 5: Build check**

```bash
cd dashboard && pnpm build
```

Fix any TypeScript errors, unused imports, missing type annotations.

- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): register P1 panels and complete i18n"
```

---

## Chunk 7: Memory Enhancement (Tasks 20–23)

> These tasks modify `extensions/memory-lancedb/`, NOT the dashboard. They enhance the memory plugin with advanced features from memory-lancedb-pro.

### Task 20: Transplant Enhanced Embedder + Chunker [backend]

covers: tasks.md > 6.1 > "Transplant enhanced embedder: multi-key rotation, LRU cache"
covers: tasks.md > 6.2 > "Transplant chunker: adaptive chunk sizing, semantic splitting"

**Files:**

- Create: `extensions/memory-lancedb/src/embedder.ts`
- Create: `extensions/memory-lancedb/src/chunker.ts`
- Create: `extensions/memory-lancedb/src/embedder.test.ts`
- Create: `extensions/memory-lancedb/src/chunker.test.ts`

**Source:** `vendor/memory-lancedb-pro/src/embedder.ts` (~970 LOC combined with chunker)

**Adaptations needed:**

- Remove `vendor/memory-lancedb-pro` specific imports
- Ensure OpenAI SDK import matches `extensions/memory-lancedb/package.json` version
- Keep LRU cache (256 entries, 30min TTL), multi-key rotation, auto-chunking
- Chunker: keep adaptive sizing, semantic splitting, overlap windows

- [ ] **Step 1: Write embedder tests**

Test LRU cache behavior (hit/miss/eviction), multi-key rotation (fallback on rate limit), auto-chunking for long documents.

- [ ] **Step 2: Transplant embedder.ts**

Copy from `vendor/memory-lancedb-pro/src/embedder.ts`, adapt imports, remove references to pro-specific modules.

- [ ] **Step 3: Write chunker tests**

Test: splits long text at paragraph boundaries, respects overlap windows, handles edge cases (empty string, single word).

- [ ] **Step 4: Transplant chunker.ts**

Copy from `vendor/memory-lancedb-pro/src/chunker.ts`, adapt imports.

- [ ] **Step 5: Run tests and commit**

```bash
cd extensions/memory-lancedb && pnpm test
git commit -m "[enhanced] [impl] feat(memory-lancedb): transplant enhanced embedder and chunker"
```

---

### Task 21: Transplant Hybrid Retriever [backend]

covers: tasks.md > 6.3 > "Transplant hybrid retriever: Vector + BM25, RRF score fusion"

**Files:**

- Create: `extensions/memory-lancedb/src/retriever.ts`
- Create: `extensions/memory-lancedb/src/retriever.test.ts`

**Source:** `vendor/memory-lancedb-pro/src/retriever.ts` (~1100 LOC)

**Key features:**

- Vector search via LanceDB
- BM25 text search (parallel)
- RRF (Reciprocal Rank Fusion) score fusion
- Configurable top-k and fusion weights

> **Codex Review Fix (CRITICAL):** Retriever imports several modules NOT in the original transplant list:
>
> - `access-tracker.ts` — must be transplanted or stubbed
> - `tier-manager.ts` — must be transplanted or stubbed
> - `smart-metadata.ts` — must be transplanted or stubbed
> - `decay-engine.ts` — listed as P3, but retriever depends on its types
>
> **Strategy:** Create interface stubs for `DecayEngine`, `TierManager`, and `SmartMetadata` types. Transplant `access-tracker.ts` (needed for access frequency tracking). The full implementations of decay-engine/tier-manager/smart-metadata are P3 — use no-op stubs for now.

- [ ] **Step 1: Write retriever tests**

Test RRF fusion logic, BM25 scoring, combined results ordering.

- [ ] **Step 2: Transplant retriever.ts**

Copy from `vendor/memory-lancedb-pro/src/retriever.ts`. Remove pro-specific imports. Ensure LanceDB SDK compatibility.

- [ ] **Step 3: Run tests and commit**

---

### Task 22: Transplant Rerank + Adaptive Retrieval + Noise Filter [backend]

covers: tasks.md > 6.4 > "Transplant Rerank support"
covers: tasks.md > 6.5 > "Transplant adaptive-retrieval"
covers: tasks.md > 6.6 > "Transplant noise-filter"

**Files:**

- Create: `extensions/memory-lancedb/src/rerank.ts`
- Create: `extensions/memory-lancedb/src/adaptive-retrieval.ts`
- Create: `extensions/memory-lancedb/src/noise-filter.ts`
- Create: `extensions/memory-lancedb/src/noise-prototypes.ts`

**Source:**

- `vendor/memory-lancedb-pro/src/retriever.ts` (rerank section, ~100 LOC)
- `vendor/memory-lancedb-pro/src/adaptive-retrieval.ts` (97 LOC)
- `vendor/memory-lancedb-pro/src/noise-filter.ts` + `noise-prototypes.ts` (~260 LOC)

**Rerank:** Cross-Encoder API call with 5s timeout, cosine similarity fallback.
**Adaptive retrieval:** Skip retrieval for greetings/commands/affirmations (regex + short-circuit).
**Noise filter:** Regex pattern matching + embedding prototype library for common noise patterns.

- [ ] **Step 1: Write tests for all three modules**

- [ ] **Step 2: Transplant rerank, adaptive-retrieval, noise-filter**

- [ ] **Step 3: Run tests and commit**

---

### Task 23: Migrate Tests + Integration [test]

covers: tasks.md > 6.7 > "Migrate tests from memory-lancedb-pro .mjs to Vitest format"

**Files:**

- Create/Modify: `extensions/memory-lancedb/src/*.test.ts`
- Modify: `extensions/memory-lancedb/package.json` (add vitest if not present)

- [ ] **Step 1: Add vitest test script to package.json**

`extensions/memory-lancedb/package.json` currently has NO `test` script. Add:

```json
"scripts": {
  "test": "vitest"
}
```

And add `vitest` to devDependencies if not already present.

> **Codex Review Fix:** Extension has no test script — `pnpm test` would fail.

- [ ] **Step 2: Check existing test setup**

Read `extensions/memory-lancedb/index.test.ts` to understand current test format.

- [ ] **Step 3: Migrate any .mjs tests to .test.ts Vitest format**

Convert test files from memory-lancedb-pro that use `.mjs` (likely Jest or raw Node assertions) to Vitest `describe/it/expect` format.

- [ ] **Step 3: Run full test suite**

```bash
cd extensions/memory-lancedb && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git commit -m "[enhanced] [impl] feat(memory-lancedb): migrate tests to Vitest and verify all modules"
```

---

## Requirement Coverage Matrix

| Spec Requirement                                                    | Tasks                                  |
| ------------------------------------------------------------------- | -------------------------------------- |
| **usage-tracking**                                                  |                                        |
| token-consumption-aggregation / "Display today's usage"             | T3                                     |
| token-consumption-aggregation / "Display 7-day and 30-day usage"    | T4                                     |
| per-model-breakdown / "Per-model breakdown"                         | T3, T4                                 |
| per-agent-breakdown / "Per-agent breakdown"                         | T3, T4                                 |
| usage-charts / "Time-series chart rendering"                        | T4                                     |
| context-window-pressure / "Context pressure warning"                | T5                                     |
| **session-browser**                                                 |                                        |
| session-list-display / "List sessions with kind badges"             | T6                                     |
| context-usage-visualization / "Context bar rendering"               | T7                                     |
| token-statistics / "Token stats display"                            | T6, T7                                 |
| conversation-history-viewer / "View session history"                | T7                                     |
| session-id-model-display / "Session ID and model display"           | T7                                     |
| **memory-browser**                                                  |                                        |
| memory-file-tree / "Display memory file tree (LanceDB enabled)"     | T10                                    |
| memory-file-tree / "Display memory file tree (file-based fallback)" | T10                                    |
| memory-file-tree / "View memory file content"                       | T11                                    |
| vector-search / "Execute vector search"                             | T11                                    |
| knowledge-graph / "Display knowledge graph"                         | T11 (deferred: simplified placeholder) |
| memory-health / "Display health diagnostics"                        | T10, T11                               |
| **log-viewer**                                                      |                                        |
| real-time-log-streaming / "Stream logs in real-time"                | T8                                     |
| log-entry-format / "Log entry format"                               | T9                                     |
| level-filter / "Filter by log level"                                | T8, T9                                 |
| level-filter / "Multiple level selection"                           | T9                                     |
| source-filter / "Filter by source"                                  | T9                                     |
| session-filter / "Filter by session"                                | T9                                     |
| **activity-feed**                                                   |                                        |
| chronological-event-timeline / "Display event timeline"             | T12, T13                               |
| chronological-event-timeline / "Real-time event arrival"            | T13                                    |
| agent-event-display / "Tool call event"                             | T13                                    |
| agent-event-display / "Agent status change"                         | T13                                    |
| event-filtering / "Filter by agent"                                 | T13                                    |
| event-filtering / "Filter by event type"                            | T13                                    |
| **channel-configuration**                                           |                                        |
| channel-list-display / "Display configured and available channels"  | T14                                    |
| channel-status / "Channel status display"                           | T14, T15                               |
| channel-config-forms / "Configure channel credentials"              | T15                                    |
| channel-enable-disable / "Disable a channel"                        | T15                                    |
| channel-enable-disable / "Re-link errored channel"                  | T15                                    |
| **config-editor**                                                   |                                        |
| schema-driven-form / "Generate form from schema"                    | T17                                    |
| schema-driven-form / "Handle nested schema objects"                 | T17                                    |
| section-navigation / "Navigate to section"                          | T17                                    |
| save-and-reload / "Save configuration changes"                      | T16, T18                               |
| save-and-reload / "Save conflict detection"                         | T16, T18                               |
| save-and-reload / "Reload configuration"                            | T18                                    |
| dirty-state / "Dirty state indicator"                               | T18                                    |
| dirty-state / "Navigation guard"                                    | T18                                    |
| **memory-enhancement**                                              |                                        |
| tasks.md 6.1: embedder                                              | T20                                    |
| tasks.md 6.2: chunker                                               | T20                                    |
| tasks.md 6.3: hybrid retriever                                      | T21                                    |
| tasks.md 6.4: rerank                                                | T22                                    |
| tasks.md 6.5: adaptive-retrieval                                    | T22                                    |
| tasks.md 6.6: noise-filter                                          | T22                                    |
| tasks.md 6.7: test migration                                        | T23                                    |

---

## File Cross-Matrix (Parallel Awareness)

Tasks that can be executed in parallel (no file conflicts):

| Parallel Group        | Tasks         | Rationale                                           |
| --------------------- | ------------- | --------------------------------------------------- |
| A: Observe panels     | T4+T5, T7, T9 | Different `components/panels/` subdirectories       |
| B: Config panels      | T15, T17+T18  | Different `components/panels/` subdirectories       |
| C: Memory Enhancement | T20, T21, T22 | Different files in `extensions/memory-lancedb/src/` |

**Serial dependencies:**

- T1 → T2 (deps + transplants before panels)
- T3 → T4 → T5 (store → components → enhancement)
- T6 → T7 (store → components)
- T8 → T9 (store → components)
- T10 → T11 (store → components)
- T12 → T13 (store → components)
- T14 → T15 (store → components)
- T16 → T17 → T18 (store → schema parser → save/conflict)
- T19 depends on all T3-T18
- T20-T23 independent of dashboard tasks (can run in parallel with Chunk 2-5)
