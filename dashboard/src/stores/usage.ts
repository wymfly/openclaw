import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageSummary {
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  totalCost: number;
}

export interface ModelBreakdown {
  model: string;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cost: number;
}

export interface AgentBreakdown {
  agentId: string;
  agentName: string;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cost: number;
}

export interface TimeseriesPoint {
  timestamp: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export type TimeWindow = "today" | "7d" | "30d";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIME_WINDOW_DAYS: Record<TimeWindow, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface UsageState {
  summary: UsageSummary | null;
  modelBreakdown: ModelBreakdown[];
  agentBreakdown: AgentBreakdown[];
  timeseries: TimeseriesPoint[];
  timeWindow: TimeWindow;
  loading: boolean;
  error: string | null;

  setTimeWindow: (window: TimeWindow) => void;
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

  setTimeWindow: (timeWindow) => set({ timeWindow }),

  fetchUsage: async () => {
    set({ loading: true, error: null });
    const days = TIME_WINDOW_DAYS[get().timeWindow];

    try {
      const [statusRes, costRes] = await Promise.all([
        fetch("/api/usage"),
        fetch(`/api/usage/cost?days=${days}`),
      ]);

      if (!statusRes.ok || !costRes.ok) {
        const errBody = !statusRes.ok ? await statusRes.json() : await costRes.json();
        set({
          error: (errBody as { error?: string }).error ?? "Failed to fetch usage",
          loading: false,
        });
        return;
      }

      const statusData = await statusRes.json();
      const costData = await costRes.json();

      set({
        summary: {
          tokensIn: statusData.tokensIn ?? 0,
          tokensOut: statusData.tokensOut ?? 0,
          totalTokens: statusData.totalTokens ?? 0,
          totalCost: costData.totalCost ?? 0,
        },
        modelBreakdown: statusData.modelBreakdown ?? [],
        agentBreakdown: statusData.agentBreakdown ?? [],
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch usage",
        loading: false,
      });
    }
  },

  fetchTimeseries: async () => {
    const days = TIME_WINDOW_DAYS[get().timeWindow];

    try {
      const res = await fetch(`/api/usage/timeseries?days=${days}`);
      if (!res.ok) {
        const errBody = await res.json();
        set({ error: (errBody as { error?: string }).error ?? "Failed to fetch timeseries" });
        return;
      }

      const data = await res.json();
      set({ timeseries: data.timeseries ?? data ?? [] });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch timeseries",
      });
    }
  },
}));
