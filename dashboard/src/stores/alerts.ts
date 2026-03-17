import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertAction = "toast" | "activity" | "webhook";

export interface AlertRule {
  id: string;
  name: string;
  entityType: string;
  condition: string;
  threshold: number;
  action: AlertAction;
  cooldownMs: number;
  lastFiredAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FiredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  entityType: string;
  condition: string;
  threshold: number;
  actualValue: number;
  severity: "info" | "warning" | "critical";
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AlertsState {
  rules: AlertRule[];
  firedAlerts: FiredAlert[];
  loading: boolean;
  error: string | null;

  fetchRules: () => Promise<void>;
  createRule: (
    rule: Omit<AlertRule, "id" | "lastFiredAt" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  updateRule: (id: string, patch: Partial<AlertRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  addFiredAlert: (alert: FiredAlert) => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  rules: [],
  firedAlerts: [],
  loading: false,
  error: null,

  fetchRules: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to fetch alert rules", loading: false });
        return;
      }
      const data = (await res.json()) as { rules: AlertRule[] };
      set({ rules: data.rules, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch alert rules",
        loading: false,
      });
    }
  },

  createRule: async (rule) => {
    set({ error: null });
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to create rule" });
        return;
      }
      const data = (await res.json()) as { rule: AlertRule };
      set((state) => ({ rules: [...state.rules, data.rule] }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to create rule",
      });
    }
  },

  updateRule: async (id, patch) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to update rule" });
        return;
      }
      const data = (await res.json()) as { rule: AlertRule };
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? data.rule : r)),
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to update rule",
      });
    }
  },

  deleteRule: async (id) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to delete rule" });
        return;
      }
      set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to delete rule",
      });
    }
  },

  addFiredAlert: (alert) => {
    set((state) => ({
      firedAlerts: [alert, ...state.firedAlerts].slice(0, 100),
    }));
  },
}));
