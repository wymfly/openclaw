import { create } from "zustand";

export type GatewayStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "error";

export type HealthSummary = {
  sessions?: { count: number; active?: number; total?: number };
  channels?: Record<string, string>;
  auth?: string;
};

export type StatusSummary = {
  sessions?: number;
  channels?: Record<string, string>;
  heartbeat?: string;
  state?: "active" | "paused";
};

interface GatewayState {
  status: GatewayStatus;
  latency: number | null;
  healthSummary: HealthSummary | null;
  statusSummary: StatusSummary | null;
  healthLoading: boolean;
  statusLoading: boolean;

  setStatus: (status: GatewayStatus) => void;
  setLatency: (ms: number | null) => void;
  fetchHealth: () => Promise<void>;
  fetchStatus: () => Promise<void>;
}

export const useGatewayStore = create<GatewayState>((set) => ({
  status: "disconnected",
  latency: null,
  healthSummary: null,
  statusSummary: null,
  healthLoading: false,
  statusLoading: false,

  setStatus: (status) => set({ status }),
  setLatency: (latency) => set({ latency }),

  fetchHealth: async () => {
    set({ healthLoading: true });
    try {
      const res = await fetch("/api/gateway/health");
      if (res.ok) {
        const data = (await res.json()) as HealthSummary;
        set({ healthSummary: data });
      }
    } catch {
      // Health fetch failed — keep previous data.
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
        set({ statusSummary: data });
      }
    } catch {
      // Status fetch failed — keep previous data.
    } finally {
      set({ statusLoading: false });
    }
  },
}));
