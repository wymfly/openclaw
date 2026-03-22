import { create } from "zustand";

export type GatewayStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "error";

export type HealthSummary = {
  sessions?: { active: number; total: number };
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
      const start = Date.now();
      const res = await fetch("/api/gateway/health");
      const latency = Date.now() - start;
      if (res.ok) {
        const raw = await res.json();
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
        set({ healthSummary: data, status: "connected", latency });
      } else {
        set({ status: "error" });
      }
    } catch {
      set({ status: "disconnected" });
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
        set({ statusSummary: data, status: "connected" });
      } else {
        set({ status: "error" });
      }
    } catch {
      set({ status: "disconnected" });
    } finally {
      set({ statusLoading: false });
    }
  },
}));
