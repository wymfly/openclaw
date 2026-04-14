import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types — Gateway diagnostics
// ---------------------------------------------------------------------------

export type GatewayStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "error";

export type ChannelHealth = {
  configured?: boolean;
  lastError?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  accountId?: string;
};

export type HealthSummary = {
  sessions?: { active: number; total: number; count?: number };
  channels?: Record<string, string | ChannelHealth>;
  auth?: string;
};

export type StatusSummary = {
  sessions?: number;
  channels?: Record<string, string>;
  heartbeat?: string;
  state?: "active" | "paused";
};

// ---------------------------------------------------------------------------
// Types — Monitor
// ---------------------------------------------------------------------------

export type MonitorTab = "overview" | "timeline" | "history";

export type LiveEventType = "tool_call" | "chat" | "status" | "agent" | "system";

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

  // Live events
  liveEvents: LiveEvent[];
  liveEventsLoading: boolean;

  // Overview stats
  stats: OverviewStats | null;
  statsLoading: boolean;

  // Filters
  filters: MonitorFilters;

  // Gateway diagnostics
  gatewayStatus: GatewayStatus;
  gatewayLatency: number | null;
  healthSummary: HealthSummary | null;
  statusSummary: StatusSummary | null;
  healthLoading: boolean;
  statusLoading: boolean;

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
  setGatewayStatus: (status: GatewayStatus) => void;
  setGatewayLatency: (ms: number | null) => void;
  fetchHealth: () => Promise<void>;
  fetchStatus: () => Promise<void>;
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

  // Gateway diagnostics
  gatewayStatus: "disconnected",
  gatewayLatency: null,
  healthSummary: null,
  statusSummary: null,
  healthLoading: false,
  statusLoading: false,

  // ── Tab ──

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Live events ──

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

  // ── Gateway diagnostics ──

  setGatewayStatus: (status) => set({ gatewayStatus: status }),
  setGatewayLatency: (latency) => set({ gatewayLatency: latency }),

  fetchHealth: async () => {
    set({ healthLoading: true });
    try {
      const start = Date.now();
      const res = await fetch("/api/gateway/health");
      const roundTripLatency = Date.now() - start;
      if (res.ok) {
        const raw = await res.json();
        const gatewayLatency =
          typeof raw?.durationMs === "number" && Number.isFinite(raw.durationMs)
            ? raw.durationMs
            : roundTripLatency;
        const agents = Array.isArray(raw.agents) ? raw.agents : [];
        const totalSessions = agents.reduce(
          (sum: number, a: { sessions?: { count?: number } }) => sum + (a.sessions?.count ?? 0),
          0,
        );
        const data: HealthSummary = {
          sessions: { active: agents.length, total: totalSessions },
          channels: raw.channels ?? {},
          auth: raw.ok ? "ok" : "unknown",
        };
        set({ healthSummary: data, gatewayStatus: "connected", gatewayLatency: gatewayLatency });
      } else {
        set({ gatewayStatus: "error" });
      }
    } catch {
      set({ gatewayStatus: "disconnected" });
    } finally {
      set({ healthLoading: false });
    }
  },

  fetchStatus: async () => {
    set({ statusLoading: true });
    try {
      const res = await fetch("/api/gateway/status");
      if (res.ok) {
        const data = (await res.json()) as StatusSummary;
        set({ statusSummary: data, gatewayStatus: "connected" });
      } else {
        set({ gatewayStatus: "error" });
      }
    } catch {
      set({ gatewayStatus: "disconnected" });
    } finally {
      set({ statusLoading: false });
    }
  },
}));
