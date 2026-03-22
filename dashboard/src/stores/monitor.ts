import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitorTab = "overview" | "timeline" | "history";

export type LiveEventType = "tool_call" | "chat" | "status" | "agent" | "system";

/** Same shape as old ActivityEvent — renamed for monitor context. */
export interface LiveEvent {
  id: string;
  timestamp: number;
  type: LiveEventType;
  agentId?: string;
  agentName?: string;
  description: string;
  details?: string;
}

export type RunStatus = "running" | "completed" | "error";

export interface RunListItem {
  runId: string;
  agentId: string | null;
  sessionKey: string | null;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  status: RunStatus;
  toolCalls: number;
  modelCalls: number;
  totalTokens: number;
}

export interface RunEventRow {
  id: number;
  run_id: string;
  seq: number;
  stream: string;
  data: string;
  agent_id: string | null;
  session_key: string | null;
  created_at: string;
}

export interface RunSummary {
  toolCalls: number;
  modelCalls: number;
  fileOps: number;
  subagentSpawns: number;
  compacted: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  durationMs: number;
  eventCount: number;
}

export interface OverviewStats {
  totalRuns: number;
  todayRuns: number;
  avgDurationMs: number;
  topAgents: Array<{ agentId: string; runCount: number }>;
}

interface MonitorFilters {
  agentId: string | null;
  sessionKey: string | null;
  since: string | null;
  until: string | null;
  status: RunStatus | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const MAX_LIVE_EVENTS = 200;
const DEFAULT_RUN_LIMIT = 50;

interface MonitorState {
  // Tab state
  activeTab: MonitorTab;

  // Selected run
  selectedRunId: string | null;

  // Runs list
  runs: RunListItem[];
  runsLoading: boolean;
  nextCursor: string | null;

  // Run detail
  runSummary: RunSummary | null;
  runEvents: RunEventRow[];
  runDetailLoading: boolean;

  // Live events (migrated from activity store)
  liveEvents: LiveEvent[];
  liveEventsLoading: boolean;

  // Overview stats
  stats: OverviewStats | null;
  statsLoading: boolean;

  // Filters
  filters: MonitorFilters;

  // Actions
  setActiveTab: (tab: MonitorTab) => void;
  addLiveEvent: (event: LiveEvent) => void;
  addLiveEvents: (events: LiveEvent[]) => void;
  fetchRuns: () => Promise<void>;
  loadMoreRuns: () => Promise<void>;
  setFilter: <K extends keyof MonitorFilters>(key: K, value: MonitorFilters[K]) => void;
  clearFilters: () => void;
  selectRun: (runId: string | null) => void;
  fetchRunDetail: (runId: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchRecentLiveEvents: () => Promise<void>;
}

const EMPTY_FILTERS: MonitorFilters = {
  agentId: null,
  sessionKey: null,
  since: null,
  until: null,
  status: null,
};

export const useMonitorStore = create<MonitorState>((set, get) => ({
  activeTab: "overview",
  selectedRunId: null,

  runs: [],
  runsLoading: false,
  nextCursor: null,

  runSummary: null,
  runEvents: [],
  runDetailLoading: false,

  liveEvents: [],
  liveEventsLoading: false,

  stats: null,
  statsLoading: false,

  filters: { ...EMPTY_FILTERS },

  // ── Tab ──

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Live events (migrated from activity store) ──

  addLiveEvent: (event) =>
    set((state) => {
      if (state.liveEvents.some((e) => e.id === event.id)) {
        return state;
      }
      const updated = [event, ...state.liveEvents];
      return { liveEvents: updated.slice(0, MAX_LIVE_EVENTS) };
    }),

  addLiveEvents: (newEvents) =>
    set((state) => {
      const existingIds = new Set(state.liveEvents.map((e) => e.id));
      const unique = newEvents.filter((e) => !existingIds.has(e.id));
      if (unique.length === 0) {
        return state;
      }
      const merged = [...unique, ...state.liveEvents]
        .toSorted((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_LIVE_EVENTS);
      return { liveEvents: merged };
    }),

  // ── Runs ──

  fetchRuns: async () => {
    set({ runsLoading: true });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      params.set("limit", String(DEFAULT_RUN_LIMIT));
      if (filters.agentId) {
        params.set("agentId", filters.agentId);
      }
      if (filters.sessionKey) {
        params.set("sessionKey", filters.sessionKey);
      }
      if (filters.since) {
        params.set("since", filters.since);
      }
      if (filters.until) {
        params.set("until", filters.until);
      }
      if (filters.status) {
        params.set("status", filters.status);
      }

      const res = await fetch(`/api/monitor/runs?${params.toString()}`);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { runs: RunListItem[]; nextCursor: string | null };
      set({ runs: data.runs, nextCursor: data.nextCursor });
    } catch {
      // Silently ignore — will retry on next fetch.
    } finally {
      set({ runsLoading: false });
    }
  },

  loadMoreRuns: async () => {
    const { runs, runsLoading, nextCursor, filters } = get();
    if (runsLoading || !nextCursor) {
      return;
    }

    set({ runsLoading: true });
    try {
      const params = new URLSearchParams();
      params.set("limit", String(DEFAULT_RUN_LIMIT));
      params.set("cursor", nextCursor);
      if (filters.agentId) {
        params.set("agentId", filters.agentId);
      }
      if (filters.sessionKey) {
        params.set("sessionKey", filters.sessionKey);
      }
      if (filters.since) {
        params.set("since", filters.since);
      }
      if (filters.until) {
        params.set("until", filters.until);
      }
      if (filters.status) {
        params.set("status", filters.status);
      }

      const res = await fetch(`/api/monitor/runs?${params.toString()}`);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { runs: RunListItem[]; nextCursor: string | null };
      set({
        runs: [...runs, ...data.runs],
        nextCursor: data.nextCursor,
      });
    } catch {
      // Silently ignore.
    } finally {
      set({ runsLoading: false });
    }
  },

  // ── Filters ──

  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () => set({ filters: { ...EMPTY_FILTERS } }),

  // ── Run detail ──

  selectRun: (runId) => set({ selectedRunId: runId }),

  fetchRunDetail: async (runId) => {
    set({ runDetailLoading: true, runSummary: null, runEvents: [] });
    try {
      const res = await fetch(`/api/monitor/runs/${encodeURIComponent(runId)}`);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { events: RunEventRow[]; summary: RunSummary | null };
      set({ runEvents: data.events, runSummary: data.summary, selectedRunId: runId });
    } catch {
      // Silently ignore.
    } finally {
      set({ runDetailLoading: false });
    }
  },

  // ── Stats ──

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const res = await fetch("/api/monitor/stats");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as OverviewStats;
      set({ stats: data });
    } catch {
      // Silently ignore.
    } finally {
      set({ statsLoading: false });
    }
  },

  // ── Live events fetch (same endpoint as old activity store) ──

  fetchRecentLiveEvents: async () => {
    set({ liveEventsLoading: true });
    try {
      const res = await fetch("/api/activity?limit=100");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { events?: LiveEvent[] };
      const events = data.events ?? [];
      set({ liveEvents: events.slice(0, MAX_LIVE_EVENTS) });
    } catch {
      // Silently ignore — will retry via SSE.
    } finally {
      set({ liveEventsLoading: false });
    }
  },
}));
