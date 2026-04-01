# Deck Usage Panel Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Deck Usage panel to consume the `sessions.usage` RPC as primary data source, adding four-dimension breakdown, latency analysis, daily time-series charts, and session-level drilldown.

**Architecture:** The store is restructured into two layers: a data layer (raw API response cache + 30s request deduplication) and a view layer (useMemo in components). `usage.cost` is retained as a fast-loading fallback for initial render. New components (DateRangePicker, LatencyCard, SessionUsageList) are added; existing ones (SummaryCards, BreakdownTable, UsageChart) are rewritten. Shared list infra from proposal 1 (SortableHeader, PaginatedList, useListState) is consumed for the breakdown table and session list.

**Tech Stack:** Next.js 15, React 19, Zustand, Recharts, next-intl, Tailwind CSS, shadcn/ui, @openclaw/lists (proposal 1)

**OpenSpec Change:** `deck-usage-panel-rebuild`

**Backend type alignment note:** The design doc references `p50/p90/p99` latency percentiles, but the actual Gateway `SessionLatencyStats` type provides `{ count, avgMs, p95Ms, minMs, maxMs }`. This plan uses the real backend fields.

---

## File Structure

| Action | File                                                         | Responsibility                                                    |
| ------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Create | `dashboard/src/app/api/usage/sessions/route.ts`              | Proxy `sessions.usage` RPC                                        |
| Create | `dashboard/src/app/api/usage/sessions/logs/route.ts`         | Proxy `sessions.usage.logs` RPC                                   |
| Modify | `dashboard/src/stores/usage.ts`                              | Rewrite: sessions.usage primary, cost fallback, date range, dedup |
| Create | `dashboard/src/stores/usage.test.ts`                         | Store unit tests                                                  |
| Modify | `dashboard/src/components/panels/usage/UsagePanel.tsx`       | New three-section layout with date range picker                   |
| Create | `dashboard/src/components/panels/usage/DateRangePicker.tsx`  | Date range shortcuts + custom range                               |
| Modify | `dashboard/src/components/panels/usage/SummaryCards.tsx`     | 6 metric cards with progressive loading                           |
| Modify | `dashboard/src/components/panels/usage/UsageChart.tsx`       | Daily aggregation + model stacked chart                           |
| Modify | `dashboard/src/components/panels/usage/BreakdownTable.tsx`   | 4-dimension tabs + SortableHeader + PaginatedList                 |
| Create | `dashboard/src/components/panels/usage/LatencyCard.tsx`      | Latency stats + daily trend line chart                            |
| Create | `dashboard/src/components/panels/usage/SessionUsageList.tsx` | Session list + expandable drilldown                               |
| Keep   | `dashboard/src/components/panels/usage/ContextPressure.tsx`  | No changes (independent component)                                |
| Modify | `dashboard/src/i18n/zh.json`                                 | Add ~35 new usage keys                                            |
| Modify | `dashboard/src/i18n/en.json`                                 | Add ~35 new usage keys                                            |

---

### Task 1: API Routes [frontend]

covers: usage-data-aggregation/spec.md > ADDED > Usage store fetches sessions.usage as primary data source > Fetch usage data for date range

**Files:**

- Create: `dashboard/src/app/api/usage/sessions/route.ts`
- Create: `dashboard/src/app/api/usage/sessions/logs/route.ts`

- [ ] **Step 1: Create sessions.usage proxy route**

Create `dashboard/src/app/api/usage/sessions/route.ts`:

```typescript
/**
 * GET /api/usage/sessions — Proxy sessions.usage RPC.
 *
 * Query params: startDate, endDate, limit
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const params: Record<string, unknown> = {};

  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const limit = sp.get("limit");

  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (limit) params.limit = parseInt(limit, 10);

  return gatewayRequest("sessions.usage", params);
});
```

- [ ] **Step 2: Create sessions.usage.logs proxy route**

Create `dashboard/src/app/api/usage/sessions/logs/route.ts`:

```typescript
/**
 * GET /api/usage/sessions/logs — Proxy sessions.usage.logs RPC.
 *
 * Query params: key, limit
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const key = sp.get("key") ?? "";
  const limit = sp.get("limit");

  const params: Record<string, unknown> = { key };
  if (limit) params.limit = parseInt(limit, 10);

  return gatewayRequest("sessions.usage.logs", params);
});
```

- [ ] **Step 3: Verify routes compile**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors in the new route files.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/usage/sessions/
git commit -m "[enhanced] feat(usage): add API routes for sessions.usage and sessions.usage.logs"
```

---

### Task 2: Store Rewrite — Types [frontend]

covers: usage-data-aggregation/spec.md > ADDED > Usage store fetches sessions.usage as primary data source > Fetch usage data for date range
covers: usage-data-aggregation/spec.md > ADDED > Usage store exposes date range state > Custom date range

**Files:**

- Modify: `dashboard/src/stores/usage.ts`

- [ ] **Step 1: Replace store types to match Gateway response**

Rewrite the types section in `dashboard/src/stores/usage.ts`. Replace all existing type definitions (lines 1–66) with:

```typescript
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Gateway response types (mirrors src/shared/usage-types.ts)
// ---------------------------------------------------------------------------

export interface CostUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  missingCostEntries: number;
}

export interface SessionModelUsage {
  provider?: string;
  model?: string;
  count: number;
  totals: CostUsageTotals;
}

export interface SessionMessageCounts {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
}

export interface SessionToolUsage {
  totalCalls: number;
  uniqueTools: number;
  tools: Array<{ name: string; count: number }>;
}

export interface SessionLatencyStats {
  count: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

export interface SessionDailyLatency extends SessionLatencyStats {
  date: string;
}

export interface SessionDailyModelUsage {
  date: string;
  provider?: string;
  model?: string;
  tokens: number;
  cost: number;
  count: number;
}

export interface DailyAggregate {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
  toolCalls: number;
  errors: number;
}

export interface SessionsUsageAggregates {
  messages: SessionMessageCounts;
  tools: SessionToolUsage;
  byModel: SessionModelUsage[];
  byProvider: SessionModelUsage[];
  byAgent: Array<{ agentId: string; totals: CostUsageTotals }>;
  byChannel: Array<{ channel: string; totals: CostUsageTotals }>;
  latency?: SessionLatencyStats;
  dailyLatency?: SessionDailyLatency[];
  modelDaily?: SessionDailyModelUsage[];
  daily: DailyAggregate[];
}

export interface SessionUsageEntry {
  key: string;
  label?: string;
  sessionId?: string;
  updatedAt?: number;
  agentId?: string;
  channel?: string;
  usage: {
    input: number;
    output: number;
    totalTokens: number;
    totalCost: number;
  } | null;
}

export interface SessionsUsageResult {
  updatedAt: number;
  startDate: string;
  endDate: string;
  sessions: SessionUsageEntry[];
  totals: CostUsageTotals;
  aggregates: SessionsUsageAggregates;
}

export interface SessionLogEntry {
  timestamp: number;
  role: "user" | "assistant" | "tool" | "toolResult";
  content: string;
  tokens?: number;
  cost?: number;
}

// Legacy type for usage.cost fallback
export interface UsageCostResult {
  updatedAt: number;
  days: number;
  totals: CostUsageTotals;
}

export type TimeWindow = "today" | "7d" | "30d" | "custom";
```

- [ ] **Step 2: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep usage.ts | head -10`
Expected: Only errors from missing store implementation (not type errors).

---

### Task 3: Store Rewrite — State and Actions [frontend]

covers: usage-data-aggregation/spec.md > ADDED > Usage store fetches sessions.usage as primary data source > Fetch usage data for date range
covers: usage-data-aggregation/spec.md > ADDED > Usage store fetches sessions.usage as primary data source > Quick time window shortcuts
covers: usage-data-aggregation/spec.md > ADDED > Usage store fetches sessions.usage as primary data source > Request deduplication
covers: usage-data-aggregation/spec.md > ADDED > Usage store provides fast initial load with usage.cost fallback > Progressive loading
covers: usage-data-aggregation/spec.md > ADDED > Usage store exposes date range state > Custom date range

**Files:**

- Modify: `dashboard/src/stores/usage.ts` (replace the store section, lines 68–160)

- [ ] **Step 1: Implement store state and actions**

Replace the entire store implementation (from `interface UsageState` to end of file) with:

```typescript
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIME_WINDOW_DAYS: Record<Exclude<TimeWindow, "custom">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface UsageState {
  // Date range
  timeWindow: TimeWindow;
  startDate: string;
  endDate: string;

  // Data
  costFallback: UsageCostResult | null;
  sessionsUsage: SessionsUsageResult | null;

  // Loading
  costLoading: boolean;
  sessionsLoading: boolean;
  error: string | null;

  // Request dedup
  _lastFetchKey: string;
  _lastFetchTime: number;

  // Actions
  setTimeWindow: (window: TimeWindow) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  fetchAll: () => Promise<void>;
  fetchSessionLogs: (key: string) => Promise<SessionLogEntry[]>;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  timeWindow: "7d",
  startDate: dateNDaysAgo(7),
  endDate: todayStr(),

  costFallback: null,
  sessionsUsage: null,

  costLoading: false,
  sessionsLoading: false,
  error: null,

  _lastFetchKey: "",
  _lastFetchTime: 0,

  setTimeWindow: (timeWindow) => {
    if (timeWindow === "custom") return; // custom range set via setCustomRange
    const days = TIME_WINDOW_DAYS[timeWindow];
    set({
      timeWindow,
      startDate: dateNDaysAgo(days),
      endDate: todayStr(),
    });
  },

  setCustomRange: (startDate, endDate) => {
    set({ timeWindow: "custom", startDate, endDate });
  },

  fetchAll: async () => {
    const { startDate, endDate, _lastFetchKey, _lastFetchTime } = get();
    const fetchKey = `${startDate}:${endDate}`;

    // Request dedup: same params within 30s
    if (fetchKey === _lastFetchKey && Date.now() - _lastFetchTime < 30_000) {
      return;
    }

    set({
      costLoading: true,
      sessionsLoading: true,
      error: null,
      _lastFetchKey: fetchKey,
      _lastFetchTime: Date.now(),
    });

    // Phase 1: Fast load via usage.cost (cached, ~<500ms)
    const days = Math.max(
      1,
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1,
    );

    try {
      const costRes = await fetch(`/api/usage/cost?days=${days}`);
      if (costRes.ok) {
        const costData = (await costRes.json()) as UsageCostResult;
        set({ costFallback: costData, costLoading: false });
      } else {
        set({ costLoading: false });
      }
    } catch {
      set({ costLoading: false });
    }

    // Phase 2: Full load via sessions.usage
    try {
      const sessRes = await fetch(`/api/usage/sessions?startDate=${startDate}&endDate=${endDate}`);
      if (!sessRes.ok) {
        const errBody = (await sessRes.json()) as { error?: string };
        set({
          error: errBody.error ?? "Failed to fetch usage",
          sessionsLoading: false,
        });
        return;
      }

      const sessData = (await sessRes.json()) as SessionsUsageResult;
      set({ sessionsUsage: sessData, sessionsLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch usage",
        sessionsLoading: false,
      });
    }
  },

  fetchSessionLogs: async (key) => {
    const res = await fetch(`/api/usage/sessions/logs?key=${encodeURIComponent(key)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { logs: SessionLogEntry[] };
    return data.logs ?? [];
  },
}));
```

- [ ] **Step 2: Verify store compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors only in downstream components that haven't been updated yet (SummaryCards, BreakdownTable, etc.), not in the store itself.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/stores/usage.ts
git commit -m "[enhanced] feat(usage): rewrite store with sessions.usage primary + cost fallback + dedup"
```

---

### Task 4: Store Unit Tests [frontend]

covers: usage-data-aggregation/spec.md > ADDED > Usage store fetches sessions.usage as primary data source > Request deduplication

**Files:**

- Create: `dashboard/src/stores/usage.test.ts`

- [ ] **Step 1: Write store tests**

Create `dashboard/src/stores/usage.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useUsageStore } from "./usage";

describe("useUsageStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useUsageStore.setState({
      timeWindow: "7d",
      costFallback: null,
      sessionsUsage: null,
      costLoading: false,
      sessionsLoading: false,
      error: null,
      _lastFetchKey: "",
      _lastFetchTime: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("setTimeWindow updates date range for 7d", () => {
    useUsageStore.getState().setTimeWindow("7d");
    const state = useUsageStore.getState();
    expect(state.timeWindow).toBe("7d");
    expect(state.endDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it("setTimeWindow updates date range for today", () => {
    useUsageStore.getState().setTimeWindow("today");
    const state = useUsageStore.getState();
    expect(state.timeWindow).toBe("today");
    expect(state.startDate).toBe(state.endDate);
  });

  it("setCustomRange sets custom dates", () => {
    useUsageStore.getState().setCustomRange("2026-03-01", "2026-03-15");
    const state = useUsageStore.getState();
    expect(state.timeWindow).toBe("custom");
    expect(state.startDate).toBe("2026-03-01");
    expect(state.endDate).toBe("2026-03-15");
  });

  it("fetchAll deduplicates within 30s", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updatedAt: 1, days: 7, totals: {} }),
    });
    globalThis.fetch = mockFetch;

    await useUsageStore.getState().fetchAll();
    const callCount = mockFetch.mock.calls.length;

    // Second call with same params should be deduped
    await useUsageStore.getState().fetchAll();
    expect(mockFetch.mock.calls.length).toBe(callCount);
  });

  it("fetchAll calls both cost and sessions endpoints", async () => {
    const calls: string[] = [];
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.includes("/sessions")
              ? {
                  updatedAt: 1,
                  startDate: "",
                  endDate: "",
                  sessions: [],
                  totals: {},
                  aggregates: {
                    messages: {},
                    tools: {},
                    byModel: [],
                    byProvider: [],
                    byAgent: [],
                    byChannel: [],
                    daily: [],
                  },
                }
              : { updatedAt: 1, days: 7, totals: {} },
          ),
      });
    });
    globalThis.fetch = mockFetch;

    await useUsageStore.getState().fetchAll();

    expect(calls.some((u) => u.includes("/api/usage/cost"))).toBe(true);
    expect(calls.some((u) => u.includes("/api/usage/sessions"))).toBe(true);
  });

  it("fetchSessionLogs calls logs endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ logs: [{ timestamp: 1, role: "user", content: "hi" }] }),
    });
    globalThis.fetch = mockFetch;

    const logs = await useUsageStore.getState().fetchSessionLogs("test-key");
    expect(logs).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/usage/sessions/logs?key=test-key"),
    );
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd dashboard && npx vitest run src/stores/usage.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/stores/usage.test.ts
git commit -m "[enhanced] test(usage): add store unit tests for date range, dedup, and fetch"
```

---

### Task 5: i18n Keys [frontend]

covers: (All specs — every component needs i18n)

**Files:**

- Modify: `dashboard/src/i18n/zh.json` (`usage` namespace, lines 679–693)
- Modify: `dashboard/src/i18n/en.json` (`usage` namespace, lines 679–693)

- [ ] **Step 1: Add new i18n keys to zh.json**

Replace the `"usage"` namespace in `dashboard/src/i18n/zh.json` (lines 679–693):

```json
  "usage": {
    "title": "用量与费用",
    "today": "今天",
    "7d": "近 7 天",
    "30d": "近 30 天",
    "custom": "自定义",
    "refresh": "刷新",
    "tokensIn": "输入 Token",
    "tokensOut": "输出 Token",
    "totalTokens": "总 Token",
    "totalCost": "总费用",
    "messages": "消息数",
    "toolCalls": "工具调用",
    "avgLatency": "平均延迟",
    "modelBreakdown": "按模型",
    "agentBreakdown": "按智能体",
    "providerBreakdown": "按供应商",
    "channelBreakdown": "按渠道",
    "noData": "暂无用量数据",
    "contextPressure": "上下文压力",
    "chart": "用量趋势",
    "chartTokens": "Token 用量",
    "chartCost": "费用",
    "chartByModel": "按模型",
    "proportion": "占比",
    "dateRange": "日期范围",
    "startDate": "开始日期",
    "endDate": "结束日期",
    "latency": "延迟分析",
    "latencyAvg": "平均",
    "latencyP95": "P95",
    "latencyMin": "最小",
    "latencyMax": "最大",
    "latencyTrend": "每日延迟趋势",
    "sessions": "Session 列表",
    "noSessions": "暂无 Session",
    "sessionKey": "会话 Key",
    "agent": "智能体",
    "cost": "费用",
    "updatedAt": "更新时间",
    "viewDetail": "查看详情",
    "sessionLogs": "使用日志",
    "logTimestamp": "时间",
    "logEvent": "事件",
    "logTokens": "Token",
    "logCost": "费用",
    "na": "N/A",
    "loadingDetail": "加载中..."
  },
```

- [ ] **Step 2: Add new i18n keys to en.json**

Replace the `"usage"` namespace in `dashboard/src/i18n/en.json` (lines 679–693):

```json
  "usage": {
    "title": "Usage & Costs",
    "today": "Today",
    "7d": "7 Days",
    "30d": "30 Days",
    "custom": "Custom",
    "refresh": "Refresh",
    "tokensIn": "Input Tokens",
    "tokensOut": "Output Tokens",
    "totalTokens": "Total Tokens",
    "totalCost": "Total Cost",
    "messages": "Messages",
    "toolCalls": "Tool Calls",
    "avgLatency": "Avg Latency",
    "modelBreakdown": "By Model",
    "agentBreakdown": "By Agent",
    "providerBreakdown": "By Provider",
    "channelBreakdown": "By Channel",
    "noData": "No usage data",
    "contextPressure": "Context Pressure",
    "chart": "Usage Trend",
    "chartTokens": "Tokens",
    "chartCost": "Cost",
    "chartByModel": "By Model",
    "proportion": "Proportion",
    "dateRange": "Date Range",
    "startDate": "Start Date",
    "endDate": "End Date",
    "latency": "Latency Analysis",
    "latencyAvg": "Avg",
    "latencyP95": "P95",
    "latencyMin": "Min",
    "latencyMax": "Max",
    "latencyTrend": "Daily Latency Trend",
    "sessions": "Sessions",
    "noSessions": "No sessions",
    "sessionKey": "Session Key",
    "agent": "Agent",
    "cost": "Cost",
    "updatedAt": "Updated",
    "viewDetail": "View Detail",
    "sessionLogs": "Usage Logs",
    "logTimestamp": "Time",
    "logEvent": "Event",
    "logTokens": "Tokens",
    "logCost": "Cost",
    "na": "N/A",
    "loadingDetail": "Loading..."
  },
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(usage): add i18n keys for rebuilt usage panel"
```

---

### Task 6: DateRangePicker Component [frontend]

covers: usage-data-aggregation/spec.md > ADDED > Usage store fetches sessions.usage as primary data source > Quick time window shortcuts
covers: usage-data-aggregation/spec.md > ADDED > Usage store exposes date range state > Custom date range

**Files:**

- Create: `dashboard/src/components/panels/usage/DateRangePicker.tsx`

- [ ] **Step 1: Create DateRangePicker**

Create `dashboard/src/components/panels/usage/DateRangePicker.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import type { TimeWindow } from "@/stores/usage";

interface DateRangePickerProps {
  timeWindow: TimeWindow;
  startDate: string;
  endDate: string;
  onWindowChange: (window: TimeWindow) => void;
  onCustomRange: (start: string, end: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

const SHORTCUTS: Exclude<TimeWindow, "custom">[] = ["today", "7d", "30d"];

export function DateRangePicker({
  timeWindow,
  startDate,
  endDate,
  onWindowChange,
  onCustomRange,
  onRefresh,
  loading,
}: DateRangePickerProps) {
  const t = useTranslations("usage");
  const [expanded, setExpanded] = useState(false);
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  const handleApplyCustom = () => {
    if (localStart && localEnd && localStart <= localEnd) {
      onCustomRange(localStart, localEnd);
      setExpanded(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Shortcut buttons */}
        <div className="flex gap-1">
          {SHORTCUTS.map((w) => (
            <button
              key={w}
              type="button"
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-colors"
              style={{
                backgroundColor: timeWindow === w ? "var(--primary)" : "transparent",
                color: timeWindow === w ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => onWindowChange(w)}
            >
              {t(w)}
            </button>
          ))}
          {/* Custom toggle */}
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-md font-medium transition-colors inline-flex items-center gap-1"
            style={{
              backgroundColor: timeWindow === "custom" ? "var(--primary)" : "transparent",
              color:
                timeWindow === "custom" ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
            onClick={() => setExpanded(!expanded)}
          >
            {t("custom")}
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Refresh */}
        <button
          type="button"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--muted-foreground)" }}
          onClick={onRefresh}
          disabled={loading}
          aria-label={t("refresh")}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Custom range panel */}
      {expanded && (
        <div
          className="flex items-center gap-2 p-2 rounded-md border"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("startDate")}
          </label>
          <input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="text-xs px-2 py-1 rounded border"
            style={{
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("endDate")}
          </label>
          <input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="text-xs px-2 py-1 rounded border"
            style={{
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="button"
            className="px-3 py-1 text-xs rounded-md font-medium"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
            onClick={handleApplyCustom}
          >
            {t("refresh")}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep DateRangePicker`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/usage/DateRangePicker.tsx
git commit -m "[enhanced] feat(usage): add DateRangePicker with shortcuts and custom range"
```

---

### Task 7: SummaryCards Rewrite [frontend]

covers: usage-multi-dimension-breakdown/spec.md > ADDED > Summary cards display six core metrics > Full metrics display
covers: usage-multi-dimension-breakdown/spec.md > ADDED > Summary cards display six core metrics > Latency metric unavailable

**Files:**

- Modify: `dashboard/src/components/panels/usage/SummaryCards.tsx`

- [ ] **Step 1: Rewrite SummaryCards for 6 metrics with progressive loading**

Replace entire content of `dashboard/src/components/panels/usage/SummaryCards.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { CostUsageTotals, SessionsUsageAggregates } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SummaryCardsProps {
  totals: CostUsageTotals | null;
  aggregates: SessionsUsageAggregates | null;
  loading: boolean;
}

export function SummaryCards({ totals, aggregates, loading }: SummaryCardsProps) {
  const t = useTranslations("usage");

  const cards: { label: string; value: string; loading: boolean }[] = [
    {
      label: t("tokensIn"),
      value: totals ? formatTokens(totals.input) : "—",
      loading: !totals && loading,
    },
    {
      label: t("tokensOut"),
      value: totals ? formatTokens(totals.output) : "—",
      loading: !totals && loading,
    },
    {
      label: t("totalCost"),
      value: totals ? formatCost(totals.totalCost) : "—",
      loading: !totals && loading,
    },
    {
      label: t("messages"),
      value: aggregates ? aggregates.messages.total.toLocaleString() : "—",
      loading: !aggregates && loading,
    },
    {
      label: t("toolCalls"),
      value: aggregates ? aggregates.tools.totalCalls.toLocaleString() : "—",
      loading: !aggregates && loading,
    },
    {
      label: t("avgLatency"),
      value: aggregates?.latency ? formatLatency(aggregates.latency.avgMs) : t("na"),
      loading: !aggregates && loading,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg p-3 border"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
            {card.label}
          </p>
          {card.loading ? (
            <div
              className="h-6 w-16 rounded animate-pulse"
              style={{ backgroundColor: "var(--muted)" }}
            />
          ) : (
            <p
              className="text-lg font-semibold tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep SummaryCards`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/usage/SummaryCards.tsx
git commit -m "[enhanced] feat(usage): rewrite SummaryCards with 6 metrics and progressive loading"
```

---

### Task 8: UsageChart Rewrite [frontend]

covers: usage-multi-dimension-breakdown/spec.md > ADDED > Time series chart uses daily aggregation data > Daily token trend
covers: usage-multi-dimension-breakdown/spec.md > ADDED > Time series chart uses daily aggregation data > Switch to cost view
covers: usage-multi-dimension-breakdown/spec.md > ADDED > Breakdown view supports four dimension tabs > Model dimension with daily breakdown

**Files:**

- Modify: `dashboard/src/components/panels/usage/UsageChart.tsx`

- [ ] **Step 1: Rewrite UsageChart with daily data + model stacking + view toggle**

Replace entire content of `dashboard/src/components/panels/usage/UsageChart.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyAggregate, SessionDailyModelUsage } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartView = "tokens" | "cost" | "byModel";

interface UsageChartProps {
  daily: DailyAggregate[];
  modelDaily?: SessionDailyModelUsage[];
}

// ---------------------------------------------------------------------------
// Colors for model stacking
// ---------------------------------------------------------------------------

const MODEL_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--purple)",
  "var(--destructive)",
  "var(--muted-foreground)",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsageChart({ daily, modelDaily }: UsageChartProps) {
  const t = useTranslations("usage");
  const [view, setView] = useState<ChartView>("tokens");

  // Build model stacked data: pivot modelDaily into { date, model1: tokens, model2: tokens, ... }
  const { modelData, modelNames } = useMemo(() => {
    if (!modelDaily || modelDaily.length === 0) return { modelData: [], modelNames: [] };

    const dateMap = new Map<string, Record<string, number>>();
    const names = new Set<string>();

    for (const entry of modelDaily) {
      const name = entry.model ?? entry.provider ?? "unknown";
      names.add(name);
      const row = dateMap.get(entry.date) ?? { date: entry.date };
      row[name] = (row[name] ?? 0) + entry.tokens;
      dateMap.set(entry.date, row);
    }

    return {
      modelData: Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      modelNames: Array.from(names),
    };
  }, [modelDaily]);

  if (daily.length === 0) return null;

  const views: { key: ChartView; label: string }[] = [
    { key: "tokens", label: t("chartTokens") },
    { key: "cost", label: t("chartCost") },
  ];
  if (modelNames.length > 0) {
    views.push({ key: "byModel", label: t("chartByModel") });
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Header with view toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {t("chart")}
        </p>
        <div className="flex gap-1">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              className="px-2 py-1 text-xs rounded font-medium transition-colors"
              style={{
                backgroundColor: view === v.key ? "var(--accent)" : "transparent",
                color: view === v.key ? "var(--foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        {view === "byModel" ? (
          <AreaChart data={modelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {modelNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="models"
                stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
                fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        ) : (
          <AreaChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {view === "tokens" ? (
              <>
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.4}
                  name={t("chartTokens")}
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey="cost"
                stroke="var(--success)"
                fill="var(--success)"
                fillOpacity={0.3}
                name={t("chartCost")}
              />
            )}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep UsageChart`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/usage/UsageChart.tsx
git commit -m "[enhanced] feat(usage): rewrite UsageChart with daily data, cost view, and model stacking"
```

---

### Task 9: BreakdownTable Rewrite [frontend]

covers: usage-multi-dimension-breakdown/spec.md > ADDED > Breakdown view supports four dimension tabs > Switch dimension tab
covers: usage-multi-dimension-breakdown/spec.md > ADDED > Breakdown table supports sorting > Sort by cost descending
covers: usage-multi-dimension-breakdown/spec.md > ADDED > Breakdown table supports pagination for large datasets > Paginate model breakdown

**Files:**

- Modify: `dashboard/src/components/panels/usage/BreakdownTable.tsx`

- [ ] **Step 1: Rewrite BreakdownTable with 4 dimensions + SortableHeader + PaginatedList**

Replace entire content of `dashboard/src/components/panels/usage/BreakdownTable.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SortableHeader, PaginatedList, useListState } from "@/components/lists";
import type { CostUsageTotals, SessionsUsageAggregates } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Dimension = "model" | "provider" | "agent" | "channel";

interface BreakdownRow {
  id: string;
  name: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  proportion: number;
}

interface BreakdownTableProps {
  aggregates: SessionsUsageAggregates | null;
  totals: CostUsageTotals | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function buildRows(
  aggregates: SessionsUsageAggregates,
  dimension: Dimension,
  totalCost: number,
): BreakdownRow[] {
  const makeProportion = (cost: number) => (totalCost > 0 ? (cost / totalCost) * 100 : 0);

  switch (dimension) {
    case "model":
      return aggregates.byModel.map((m, i) => ({
        id: `model-${i}`,
        name: m.model ?? m.provider ?? "unknown",
        tokensIn: m.totals.input,
        tokensOut: m.totals.output,
        cost: m.totals.totalCost,
        proportion: makeProportion(m.totals.totalCost),
      }));
    case "provider":
      return aggregates.byProvider.map((p, i) => ({
        id: `provider-${i}`,
        name: p.provider ?? "unknown",
        tokensIn: p.totals.input,
        tokensOut: p.totals.output,
        cost: p.totals.totalCost,
        proportion: makeProportion(p.totals.totalCost),
      }));
    case "agent":
      return aggregates.byAgent.map((a) => ({
        id: `agent-${a.agentId}`,
        name: a.agentId,
        tokensIn: a.totals.input,
        tokensOut: a.totals.output,
        cost: a.totals.totalCost,
        proportion: makeProportion(a.totals.totalCost),
      }));
    case "channel":
      return aggregates.byChannel.map((c) => ({
        id: `channel-${c.channel}`,
        name: c.channel,
        tokensIn: c.totals.input,
        tokensOut: c.totals.output,
        cost: c.totals.totalCost,
        proportion: makeProportion(c.totals.totalCost),
      }));
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BreakdownTable({ aggregates, totals }: BreakdownTableProps) {
  const t = useTranslations("usage");
  const [dimension, setDimension] = useState<Dimension>("model");

  const rows = useMemo(() => {
    if (!aggregates || !totals) return [];
    return buildRows(aggregates, dimension, totals.totalCost);
  }, [aggregates, totals, dimension]);

  const { sortedData, paginatedData, sort, setSort, page, totalPages, setPage } = useListState({
    data: rows,
    pageSize: 20,
  });

  const tabs: { key: Dimension; label: string }[] = [
    { key: "model", label: t("modelBreakdown") },
    { key: "provider", label: t("providerBreakdown") },
    { key: "agent", label: t("agentBreakdown") },
    { key: "channel", label: t("channelBreakdown") },
  ];

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Tab bar */}
      <div className="flex gap-0 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: dimension === tab.key ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom:
                dimension === tab.key ? "2px solid var(--primary)" : "2px solid transparent",
              backgroundColor: "transparent",
            }}
            onClick={() => setDimension(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th
                className="text-left px-4 py-2 font-medium border-b"
                style={{
                  color: "var(--muted-foreground)",
                  borderColor: "var(--border)",
                }}
              >
                Name
              </th>
              <th
                className="text-right px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <SortableHeader columnKey="tokensIn" sort={sort} onSortChange={setSort}>
                  {t("tokensIn")}
                </SortableHeader>
              </th>
              <th
                className="text-right px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <SortableHeader columnKey="tokensOut" sort={sort} onSortChange={setSort}>
                  {t("tokensOut")}
                </SortableHeader>
              </th>
              <th
                className="text-right px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <SortableHeader columnKey="cost" sort={sort} onSortChange={setSort}>
                  {t("totalCost")}
                </SortableHeader>
              </th>
              <th
                className="text-right px-4 py-2 font-medium border-b"
                style={{
                  color: "var(--muted-foreground)",
                  borderColor: "var(--border)",
                }}
              >
                {t("proportion")}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {t("noData")}
                </td>
              </tr>
            )}
            {paginatedData.map((row) => (
              <tr
                key={row.id}
                className="border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-2" style={{ color: "var(--foreground)" }}>
                  {row.name}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  {row.tokensIn.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  {row.tokensOut.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  {formatCost(row.cost)}
                </td>
                <td className="px-4 py-2 text-right" style={{ color: "var(--foreground)" }}>
                  <div className="flex items-center justify-end gap-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.max(2, row.proportion)}%`,
                        maxWidth: "60px",
                        backgroundColor: "var(--primary)",
                        opacity: 0.6,
                      }}
                    />
                    <span
                      className="text-xs tabular-nums"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {row.proportion.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <PaginatedList
          mode="button"
          page={page}
          totalPages={totalPages}
          totalItems={sortedData.length}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep BreakdownTable`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/usage/BreakdownTable.tsx
git commit -m "[enhanced] feat(usage): rewrite BreakdownTable with 4 dimensions, sorting, and pagination"
```

---

### Task 10: LatencyCard [frontend]

covers: usage-latency-analysis/spec.md > ADDED > Latency card displays percentile statistics > Display latency percentiles
covers: usage-latency-analysis/spec.md > ADDED > Latency card displays percentile statistics > Latency data unavailable
covers: usage-latency-analysis/spec.md > ADDED > Latency card shows daily trend > Daily latency trend
covers: usage-latency-analysis/spec.md > ADDED > Latency card shows daily trend > Single day range

**Files:**

- Create: `dashboard/src/components/panels/usage/LatencyCard.tsx`

- [ ] **Step 1: Create LatencyCard with stats + daily trend chart**

Create `dashboard/src/components/panels/usage/LatencyCard.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SessionLatencyStats, SessionDailyLatency } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LatencyCardProps {
  latency?: SessionLatencyStats;
  dailyLatency?: SessionDailyLatency[];
}

export function LatencyCard({ latency, dailyLatency }: LatencyCardProps) {
  const t = useTranslations("usage");

  // Don't render if latency data is not available (conditional rendering per spec)
  if (!latency) return null;

  const stats: { label: string; value: string }[] = [
    { label: t("latencyAvg"), value: formatMs(latency.avgMs) },
    { label: t("latencyP95"), value: formatMs(latency.p95Ms) },
    { label: t("latencyMin"), value: formatMs(latency.minMs) },
    { label: t("latencyMax"), value: formatMs(latency.maxMs) },
  ];

  // Only show trend chart if more than 1 day of data
  const showTrend = dailyLatency && dailyLatency.length > 1;

  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <p className="text-sm font-medium mb-3" style={{ color: "var(--foreground)" }}>
        {t("latency")}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {s.label}
            </p>
            <p
              className="text-base font-semibold tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      {showTrend && (
        <>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
            {t("latencyTrend")}
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={dailyLatency}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickFormatter={(v) => formatMs(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatMs(value), ""]}
              />
              <Line
                type="monotone"
                dataKey="avgMs"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                name={t("latencyAvg")}
              />
              <Line
                type="monotone"
                dataKey="p95Ms"
                stroke="var(--warning)"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                name={t("latencyP95")}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep LatencyCard`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/usage/LatencyCard.tsx
git commit -m "[enhanced] feat(usage): add LatencyCard with stats and daily trend chart"
```

---

### Task 11: SessionUsageList [frontend]

covers: usage-session-drilldown/spec.md > ADDED > Session list displays usage summary per session > Display session list
covers: usage-session-drilldown/spec.md > ADDED > Session list displays usage summary per session > Empty sessions
covers: usage-session-drilldown/spec.md > ADDED > Session drilldown shows detailed usage logs > Expand session detail
covers: usage-session-drilldown/spec.md > ADDED > Session drilldown shows detailed usage logs > Loading state during drilldown
covers: usage-session-drilldown/spec.md > ADDED > Session drilldown shows detailed usage logs > Navigate to session detail panel
covers: usage-session-drilldown/spec.md > ADDED > Session list supports search > Search sessions by agent name

**Files:**

- Create: `dashboard/src/components/panels/usage/SessionUsageList.tsx`

- [ ] **Step 1: Create SessionUsageList with search, pagination, and expandable drilldown**

Create `dashboard/src/components/panels/usage/SessionUsageList.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { ListSearchBar, PaginatedList, useListState } from "@/components/lists";
import { useUsageStore, type SessionUsageEntry, type SessionLogEntry } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionUsageListProps {
  sessions: SessionUsageEntry[];
  onNavigateToSession?: (key: string) => void;
}

export function SessionUsageList({ sessions, onNavigateToSession }: SessionUsageListProps) {
  const t = useTranslations("usage");
  const fetchSessionLogs = useUsageStore((s) => s.fetchSessionLogs);

  // Expanded session state
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<SessionLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // List state with search and pagination
  const { filteredData, paginatedData, page, totalPages, setPage, filters, setFilters } =
    useListState({
      data: sessions,
      pageSize: 20,
      filterFn: (item, f: { search?: string }) => {
        if (!f.search) return true;
        const q = f.search.toLowerCase();
        return (
          item.key.toLowerCase().includes(q) ||
          (item.agentId?.toLowerCase().includes(q) ?? false) ||
          (item.label?.toLowerCase().includes(q) ?? false)
        );
      },
    });

  const handleSearch = useCallback(
    (query: string) => {
      setFilters({ search: query || undefined });
    },
    [setFilters],
  );

  const handleToggle = useCallback(
    async (key: string) => {
      if (expandedKey === key) {
        setExpandedKey(null);
        return;
      }
      setExpandedKey(key);
      setLogsLoading(true);
      try {
        const result = await fetchSessionLogs(key);
        setLogs(result);
      } catch {
        setLogs([]);
      } finally {
        setLogsLoading(false);
      }
    },
    [expandedKey, fetchSessionLogs],
  );

  if (sessions.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t("noSessions")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Header with search */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {t("sessions")} ({filteredData.length})
        </p>
        <div className="w-64">
          <ListSearchBar
            value={filters.search ?? ""}
            onSearch={handleSearch}
            placeholder={t("sessionKey")}
          />
        </div>
      </div>

      {/* Session rows */}
      <div>
        {paginatedData.map((session) => {
          const isExpanded = expandedKey === session.key;
          return (
            <div key={session.key}>
              <div
                className="flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer hover:bg-[var(--accent)]"
                style={{ borderColor: "var(--border)" }}
                onClick={() => handleToggle(session.key)}
              >
                {/* Expand icon */}
                {isExpanded ? (
                  <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} />
                ) : (
                  <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
                )}

                {/* Session info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-mono truncate"
                    style={{ color: "var(--foreground)" }}
                    title={session.key}
                  >
                    {session.key}
                  </p>
                  {session.agentId && (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {session.agentId}
                    </p>
                  )}
                </div>

                {/* Tokens + Cost */}
                <div className="text-right shrink-0">
                  <p className="text-xs tabular-nums" style={{ color: "var(--foreground)" }}>
                    {session.usage ? `${session.usage.totalTokens.toLocaleString()} tokens` : "—"}
                  </p>
                  <p className="text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                    {session.usage ? formatCost(session.usage.totalCost) : "—"}
                  </p>
                </div>

                {/* Navigate button */}
                {onNavigateToSession && (
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-[var(--accent)]"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToSession(session.key);
                    }}
                    title={t("viewDetail")}
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>

              {/* Expanded logs */}
              {isExpanded && (
                <div
                  className="px-4 py-3 border-b"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                >
                  {logsLoading ? (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {t("loadingDetail")}
                    </p>
                  ) : logs.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {t("noData")}
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th
                            className="text-left py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logTimestamp")}
                          </th>
                          <th
                            className="text-left py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logEvent")}
                          </th>
                          <th
                            className="text-right py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logTokens")}
                          </th>
                          <th
                            className="text-right py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logCost")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                            <td
                              className="py-1 tabular-nums"
                              style={{ color: "var(--foreground)" }}
                            >
                              {formatTime(log.timestamp)}
                            </td>
                            <td className="py-1" style={{ color: "var(--foreground)" }}>
                              {log.role}
                            </td>
                            <td
                              className="py-1 text-right tabular-nums"
                              style={{ color: "var(--foreground)" }}
                            >
                              {log.tokens?.toLocaleString() ?? "—"}
                            </td>
                            <td
                              className="py-1 text-right tabular-nums"
                              style={{ color: "var(--foreground)" }}
                            >
                              {log.cost != null ? formatCost(log.cost) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <PaginatedList
          mode="button"
          page={page}
          totalPages={totalPages}
          totalItems={filteredData.length}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep SessionUsageList`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/usage/SessionUsageList.tsx
git commit -m "[enhanced] feat(usage): add SessionUsageList with search, pagination, and drilldown"
```

---

### Task 12: UsagePanel Layout Rewrite [frontend]

covers: (All specs — panel orchestrates all sub-components)

**Files:**

- Modify: `dashboard/src/components/panels/usage/UsagePanel.tsx`

- [ ] **Step 1: Rewrite UsagePanel with new layout**

Replace entire content of `dashboard/src/components/panels/usage/UsagePanel.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useUsageStore } from "@/stores/usage";
import { BreakdownTable } from "./BreakdownTable";
import { ContextPressure } from "./ContextPressure";
import { DateRangePicker } from "./DateRangePicker";
import { LatencyCard } from "./LatencyCard";
import { SessionUsageList } from "./SessionUsageList";
import { SummaryCards } from "./SummaryCards";
import { UsageChart } from "./UsageChart";

export function UsagePanel() {
  const t = useTranslations("usage");

  const {
    timeWindow,
    startDate,
    endDate,
    costFallback,
    sessionsUsage,
    costLoading,
    sessionsLoading,
    error,
    setTimeWindow,
    setCustomRange,
    fetchAll,
  } = useUsageStore();

  // Fetch data on mount and when date range changes
  useEffect(() => {
    void fetchAll();
  }, [startDate, endDate, fetchAll]);

  // Derive display data: prefer sessionsUsage, fall back to costFallback for totals
  const totals = sessionsUsage?.totals ?? costFallback?.totals ?? null;
  const aggregates = sessionsUsage?.aggregates ?? null;
  const isLoading = costLoading || sessionsLoading;

  // Force refresh (reset dedup)
  const handleRefresh = () => {
    useUsageStore.setState({ _lastFetchKey: "", _lastFetchTime: 0 });
    void fetchAll();
  };

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header: date range + refresh */}
      <div
        className="px-4 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {t("title")}
          </h2>
        </div>
        <DateRangePicker
          timeWindow={timeWindow}
          startDate={startDate}
          endDate={endDate}
          onWindowChange={setTimeWindow}
          onCustomRange={setCustomRange}
          onRefresh={handleRefresh}
          loading={isLoading}
        />
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ backgroundColor: "var(--background)" }}
      >
        {error && !isLoading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Summary cards — show as soon as any totals available */}
        <SummaryCards totals={totals} aggregates={aggregates} loading={isLoading} />

        {/* Time series chart */}
        {aggregates && <UsageChart daily={aggregates.daily} modelDaily={aggregates.modelDaily} />}

        {/* Main content: breakdown + context pressure side by side on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <BreakdownTable aggregates={aggregates} totals={totals} />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <ContextPressure />
            {aggregates && (
              <LatencyCard latency={aggregates.latency} dailyLatency={aggregates.dailyLatency} />
            )}
          </div>
        </div>

        {/* Session drilldown */}
        {sessionsUsage && <SessionUsageList sessions={sessionsUsage.sessions} />}

        {/* Empty state */}
        {!isLoading && !error && !totals && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{t("noData")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero type errors across all modified files.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/usage/UsagePanel.tsx
git commit -m "[enhanced] feat(usage): rewrite UsagePanel with new three-section layout"
```

---

### Task 13: Integration Verification [frontend]

covers: (All specs — end-to-end verification)

**Files:** (no new files)

- [ ] **Step 1: Run tsc --noEmit**

Run: `cd dashboard && npx tsc --noEmit --pretty`
Expected: Zero errors. Fix any remaining type issues.

- [ ] **Step 2: Run store tests**

Run: `cd dashboard && npx vitest run src/stores/usage.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Run list infra tests (regression)**

Run: `cd dashboard && npx vitest run src/components/lists/useListState.test.ts`
Expected: All 20 tests pass.

- [ ] **Step 4: Verify dark mode CSS variables**

Confirm all color references in new/modified components use CSS variables (no hardcoded colors):

- `var(--card)`, `var(--border)`, `var(--foreground)`, `var(--muted-foreground)`, `var(--primary)`, `var(--accent)`, `var(--background)`, `var(--muted)`, `var(--success)`, `var(--warning)`, `var(--purple)`, `var(--destructive)`

All are defined in `dashboard/src/app/globals.css` for both `:root` and `.dark`.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "[enhanced] feat(usage): complete usage panel rebuild — all tasks verified"
```

---

## Requirement Coverage Matrix

| Spec Requirement                                                                                         | Task         |
| -------------------------------------------------------------------------------------------------------- | ------------ |
| usage-data-aggregation > Usage store fetches sessions.usage > Fetch usage data for date range            | Task 1, 2, 3 |
| usage-data-aggregation > Usage store fetches sessions.usage > Quick time window shortcuts                | Task 3, 6    |
| usage-data-aggregation > Usage store fetches sessions.usage > Request deduplication                      | Task 3, 4    |
| usage-data-aggregation > Usage store provides fast initial load > Progressive loading                    | Task 3, 7    |
| usage-data-aggregation > Usage store exposes date range state > Custom date range                        | Task 2, 3, 6 |
| usage-multi-dimension-breakdown > Four dimension tabs > Switch dimension tab                             | Task 9       |
| usage-multi-dimension-breakdown > Four dimension tabs > Model dimension with daily breakdown             | Task 8, 9    |
| usage-multi-dimension-breakdown > Breakdown table supports sorting > Sort by cost descending             | Task 9       |
| usage-multi-dimension-breakdown > Breakdown table supports pagination > Paginate model breakdown         | Task 9       |
| usage-multi-dimension-breakdown > Summary cards display six core metrics > Full metrics display          | Task 7       |
| usage-multi-dimension-breakdown > Summary cards display six core metrics > Latency metric unavailable    | Task 7       |
| usage-multi-dimension-breakdown > Time series chart uses daily aggregation data > Daily token trend      | Task 8       |
| usage-multi-dimension-breakdown > Time series chart uses daily aggregation data > Switch to cost view    | Task 8       |
| usage-latency-analysis > Latency card displays percentile statistics > Display latency percentiles       | Task 10      |
| usage-latency-analysis > Latency card displays percentile statistics > Latency data unavailable          | Task 10      |
| usage-latency-analysis > Latency card shows daily trend > Daily latency trend                            | Task 10      |
| usage-latency-analysis > Latency card shows daily trend > Single day range                               | Task 10      |
| usage-session-drilldown > Session list displays usage summary > Display session list                     | Task 11      |
| usage-session-drilldown > Session list displays usage summary > Empty sessions                           | Task 11      |
| usage-session-drilldown > Session drilldown shows detailed usage logs > Expand session detail            | Task 11      |
| usage-session-drilldown > Session drilldown shows detailed usage logs > Loading state during drilldown   | Task 11      |
| usage-session-drilldown > Session drilldown shows detailed usage logs > Navigate to session detail panel | Task 11      |
| usage-session-drilldown > Session list supports search > Search sessions by agent name                   | Task 11      |

All 23 spec requirements are covered.
