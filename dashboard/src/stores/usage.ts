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
  role: "user" | "assistant" | "tool" | "toolResult" | "compactionSummary";
  content: string;
  tokens?: number;
  cost?: number;
}

/** Safely narrow unknown[] log entries from sessions.usage.logs to SessionLogEntry[]. */
export function parseSessionLogs(raw: unknown[]): SessionLogEntry[] {
  // Cast: gateway returns logs matching SessionLogEntry shape per
  // src/infra/session-cost-usage.ts — unknown[] is a codegen limitation.
  return (raw as Record<string, unknown>[])
    .filter(
      (entry) =>
        typeof entry.timestamp === "number" &&
        typeof entry.role === "string" &&
        typeof entry.content === "string",
    )
    .map((entry) => ({
      timestamp: entry.timestamp as number,
      role: entry.role as SessionLogEntry["role"],
      content: entry.content as string,
      ...(typeof entry.tokens === "number" ? { tokens: entry.tokens } : {}),
      ...(typeof entry.cost === "number" ? { cost: entry.cost } : {}),
    }));
}

/**
 * Local interface mirroring SessionSystemPromptReport from
 * src/config/sessions/types.ts:340-389. The generated type for contextWeight
 * is `unknown`; this provides compile-time safety in the dashboard.
 */
export interface ContextWeightReport {
  source: "run" | "estimate";
  generatedAt: number;
  systemPrompt: {
    chars: number;
    projectContextChars: number;
    nonProjectContextChars: number;
  };
  tools: {
    listChars: number;
    schemaChars: number;
    entries: Array<{
      name: string;
      summaryChars: number;
      schemaChars: number;
      propertiesCount?: number | null;
    }>;
  };
  skills: {
    promptChars: number;
    entries: Array<{ name: string; blockChars: number }>;
  };
  injectedWorkspaceFiles?: Array<{
    name: string;
    path: string;
    injectedChars: number;
    rawChars: number;
    truncated: boolean;
    missing: boolean;
  }>;
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

  // Context weight
  contextWeightCache: Record<string, ContextWeightReport>;
  contextWeightLoading: boolean;
  contextWeightError: string | null;

  // Usage logs (per-turn)
  usageLogs: Record<string, SessionLogEntry[]>;
  usageLogsLoading: boolean;
  usageLogsError: string | null;

  // Actions
  setTimeWindow: (window: TimeWindow) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  fetchAll: () => Promise<void>;
  fetchSessionLogs: (key: string) => Promise<SessionLogEntry[]>;
  fetchContextWeight: (key: string) => Promise<void>;
  fetchUsageLogs: (key: string) => Promise<void>;
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

  contextWeightCache: {},
  contextWeightLoading: false,
  contextWeightError: null,

  usageLogs: {},
  usageLogsLoading: false,
  usageLogsError: null,

  setTimeWindow: (timeWindow) => {
    if (timeWindow === "custom") {
      return;
    }
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
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
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
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      set({
        error: err instanceof Error ? err.message : "Failed to fetch usage",
        sessionsLoading: false,
      });
    }
  },

  fetchSessionLogs: async (key) => {
    const res = await fetch(`/api/usage/sessions/logs?key=${encodeURIComponent(key)}`);
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as { logs: SessionLogEntry[] };
    return data.logs ?? [];
  },

  fetchContextWeight: async (key) => {
    if (get().contextWeightCache[key]) return;
    set({ contextWeightLoading: true, contextWeightError: null });
    try {
      const res = await fetch(
        `/api/usage/sessions?key=${encodeURIComponent(key)}&includeContextWeight=true`,
      );
      if (!res.ok) {
        set({ contextWeightLoading: false, contextWeightError: "Failed to fetch context weight" });
        return;
      }
      const data = (await res.json()) as {
        sessions?: Array<{ contextWeight?: unknown }>;
      };
      const cw = data.sessions?.[0]?.contextWeight;
      if (cw && typeof cw === "object") {
        // Cast: mirrors SessionSystemPromptReport from src/config/sessions/types.ts:340
        const report = cw as ContextWeightReport;
        set((s) => ({
          contextWeightCache: { ...s.contextWeightCache, [key]: report },
          contextWeightLoading: false,
        }));
      } else {
        set({ contextWeightLoading: false, contextWeightError: "empty" });
      }
    } catch (err) {
      set({
        contextWeightLoading: false,
        contextWeightError: err instanceof Error ? err.message : "Failed to fetch context weight",
      });
    }
  },

  fetchUsageLogs: async (key) => {
    if (get().usageLogs[key]) return;
    set({ usageLogsLoading: true, usageLogsError: null });
    try {
      const res = await fetch(`/api/usage/sessions/logs?key=${encodeURIComponent(key)}`);
      if (!res.ok) {
        set({ usageLogsLoading: false, usageLogsError: "Failed to fetch logs" });
        return;
      }
      const data = (await res.json()) as { logs?: unknown[] };
      const logs = data.logs ? parseSessionLogs(data.logs) : [];
      set((s) => ({
        usageLogs: { ...s.usageLogs, [key]: logs },
        usageLogsLoading: false,
      }));
    } catch (err) {
      set({
        usageLogsLoading: false,
        usageLogsError: err instanceof Error ? err.message : "Failed to fetch logs",
      });
    }
  },
}));
