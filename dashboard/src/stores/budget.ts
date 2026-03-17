import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetDimension = "tokensIn" | "tokensOut" | "totalTokens" | "cost";
export type BudgetStatus = "ok" | "warn" | "over";

export interface BudgetRule {
  id: string;
  name: string;
  scope: string;
  agentId: string | null;
  taskId: string | null;
  dimension: BudgetDimension;
  warnThreshold: number | null;
  overThreshold: number | null;
  period: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  status: BudgetStatus;
  current: number;
  warnThreshold: number | null;
  overThreshold: number | null;
  dimension: BudgetDimension;
}

export interface CreateRuleInput {
  name: string;
  scope: string;
  agentId?: string;
  taskId?: string;
  dimension: BudgetDimension;
  warnThreshold?: number;
  overThreshold?: number;
  period: string;
  enabled?: boolean;
}

export type UpdateRuleInput = Partial<CreateRuleInput>;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface BudgetState {
  rules: BudgetRule[];
  evaluations: RuleEvaluation[];
  loading: boolean;
  error: string | null;

  fetchRules: () => Promise<void>;
  createRule: (input: CreateRuleInput) => Promise<void>;
  updateRule: (id: string, input: UpdateRuleInput) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  evaluateBudgets: () => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  rules: [],
  evaluations: [],
  loading: false,
  error: null,

  fetchRules: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/usage/budget");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to fetch rules", loading: false });
        return;
      }
      const data = (await res.json()) as { rules: BudgetRule[] };
      set({ rules: data.rules, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch rules", loading: false });
    }
  },

  createRule: async (input) => {
    set({ error: null });
    try {
      const res = await fetch("/api/usage/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to create rule" });
        return;
      }
      await get().fetchRules();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create rule" });
    }
  },

  updateRule: async (id, input) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/usage/budget/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to update rule" });
        return;
      }
      await get().fetchRules();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update rule" });
    }
  },

  deleteRule: async (id) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/usage/budget/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to delete rule" });
        return;
      }
      await get().fetchRules();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete rule" });
    }
  },

  evaluateBudgets: async () => {
    try {
      const res = await fetch("/api/usage/budget/evaluate");
      if (!res.ok) {
        set({ evaluations: [] });
        return;
      }
      const data = (await res.json()) as { evaluations: RuleEvaluation[] };
      set({ evaluations: data.evaluations });
    } catch {
      set({ evaluations: [] });
    }
  },
}));
