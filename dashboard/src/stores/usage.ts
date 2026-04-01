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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIME_WINDOW_DAYS: Record<Exclude<TimeWindow, "custom">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return localDateStr(d);
}

function todayStr(): string {
  return localDateStr(new Date());
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

  // Request dedup + abort
  _lastFetchKey: string;
  _lastFetchTime: number;
  _abortController: AbortController | null;

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
  _abortController: null,

  setTimeWindow: (timeWindow) => {
    if (timeWindow === "custom") return;
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
    const { startDate, endDate, _lastFetchKey, _lastFetchTime, _abortController } = get();
    const fetchKey = `${startDate}:${endDate}`;

    // Request dedup: same params within 30s
    if (fetchKey === _lastFetchKey && Date.now() - _lastFetchTime < 30_000) {
      return;
    }

    // Abort any in-flight requests from a previous call
    _abortController?.abort();
    const ac = new AbortController();

    set({
      costLoading: true,
      sessionsLoading: true,
      error: null,
      _lastFetchKey: fetchKey,
      _lastFetchTime: Date.now(),
      _abortController: ac,
    });

    // Phase 1: Fast load via usage.cost (cached, ~<500ms)
    // Note: usage.cost only accepts `days` param, not startDate/endDate.
    // For custom ranges this is an approximation; sessions.usage (phase 2) provides exact data.
    const days = Math.max(
      1,
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1,
    );

    try {
      const costRes = await fetch(`/api/usage/cost?days=${days}`, { signal: ac.signal });
      if (costRes.ok) {
        const costData = (await costRes.json()) as UsageCostResult;
        set({ costFallback: costData, costLoading: false });
      } else {
        set({ costLoading: false });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      set({ costLoading: false });
    }

    // Phase 2: Full load via sessions.usage
    try {
      const sessRes = await fetch(`/api/usage/sessions?startDate=${startDate}&endDate=${endDate}`, {
        signal: ac.signal,
      });
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
      if (err instanceof DOMException && err.name === "AbortError") return;
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
