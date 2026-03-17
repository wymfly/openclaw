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

      const statusData = (await statusRes.json()) as Record<string, unknown>;
      const costData = (await costRes.json()) as Record<string, unknown>;

      // usage.status returns `{ updatedAt, providers: [...] }` — aggregate across providers.
      let tokensIn = 0;
      let tokensOut = 0;
      let totalTokens = 0;
      const providers = Array.isArray(statusData.providers) ? statusData.providers : [];
      for (const p of providers as Record<string, unknown>[]) {
        tokensIn += Number(p.inputTokens ?? p.tokensIn ?? 0);
        tokensOut += Number(p.outputTokens ?? p.tokensOut ?? 0);
        totalTokens += Number(p.totalTokens ?? 0);
      }
      // Fallback: if top-level fields exist (legacy gateway), use them.
      if (providers.length === 0) {
        tokensIn = Number(statusData.tokensIn ?? statusData.inputTokens ?? 0);
        tokensOut = Number(statusData.tokensOut ?? statusData.outputTokens ?? 0);
        totalTokens = Number(statusData.totalTokens ?? 0);
      }
      if (totalTokens === 0 && (tokensIn > 0 || tokensOut > 0)) {
        totalTokens = tokensIn + tokensOut;
      }

      // usage.cost returns `{ totalCost }` or `{ cost }`.
      const totalCost = Number(costData.totalCost ?? costData.cost ?? 0);

      set({
        summary: { tokensIn, tokensOut, totalTokens, totalCost },
        modelBreakdown: (statusData.modelBreakdown as ModelBreakdown[]) ?? [],
        agentBreakdown: (statusData.agentBreakdown as AgentBreakdown[]) ?? [],
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
        // Timeseries may not be available (requires session key); degrade gracefully.
        set({ timeseries: [] });
        return;
      }

      const data = (await res.json()) as Record<string, unknown>;
      // Gateway returns `{ points: [...] }` — unwrap from `points` if present.
      const raw = Array.isArray(data.points)
        ? data.points
        : Array.isArray(data.timeseries)
          ? data.timeseries
          : Array.isArray(data)
            ? data
            : [];
      // Map gateway field names (input/output) to store field names (tokensIn/tokensOut).
      const timeseries: TimeseriesPoint[] = (raw as Record<string, unknown>[]).map((p) => ({
        timestamp: Number(p.timestamp ?? 0),
        tokensIn: Number(p.input ?? p.tokensIn ?? 0),
        tokensOut: Number(p.output ?? p.tokensOut ?? 0),
        cost: Number(p.cost ?? 0),
      }));
      set({ timeseries });
    } catch {
      // Timeseries fetch is best-effort; don't set error state.
      set({ timeseries: [] });
    }
  },
}));
