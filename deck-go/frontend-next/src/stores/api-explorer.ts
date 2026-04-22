import { create } from "zustand";
import { deckFetch } from "@/lib/deck-client";
import type { GatewayDescribeResult } from "@/types/gateway-protocol.generated";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MethodInfo = {
  name: string;
  scope: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  since?: number;
};

export type EventInfo = {
  name: string;
  payload?: Record<string, unknown>;
  since?: number;
};

type ApiExplorerState = {
  methods: MethodInfo[];
  events: EventInfo[];
  untyped: string[];
  search: string;
  selectedMethod: string | null;
  loading: boolean;
  error: string | null;
};

type ApiExplorerActions = {
  fetchDescribe: () => Promise<void>;
  setSearch: (q: string) => void;
  setSelectedMethod: (name: string | null) => void;
};

export const useApiExplorerStore = create<ApiExplorerState & ApiExplorerActions>((set, get) => ({
  methods: [],
  events: [],
  untyped: [],
  search: "",
  selectedMethod: null,
  loading: false,
  error: null,

  fetchDescribe: async () => {
    if (get().loading) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await deckFetch("/api/gateway/describe");
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        set({ loading: false, error: (body as { error?: string }).error ?? "Request failed" });
        return;
      }
      const data = (await res.json()) as GatewayDescribeResult;

      const methods: MethodInfo[] = Object.entries(data.methods).map(([name, meta]) => ({
        name,
        scope: meta.scope,
        params: meta.params,
        result: meta.result,
        since: meta.since,
      }));
      methods.sort((a, b) => a.name.localeCompare(b.name));

      const events: EventInfo[] = Object.entries(data.events).map(([name, meta]) => ({
        name,
        payload: meta.payload,
        since: meta.since,
      }));
      events.sort((a, b) => a.name.localeCompare(b.name));

      set({
        methods,
        events,
        untyped: data.untyped ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  setSearch: (q) => set({ search: q }),
  setSelectedMethod: (name) => set({ selectedMethod: name }),
}));

/** Group methods by domain prefix (e.g. "agent", "chat", "sessions"). */
export function groupMethodsByDomain(methods: MethodInfo[]): Record<string, MethodInfo[]> {
  const groups: Record<string, MethodInfo[]> = {};
  for (const m of methods) {
    const dot = m.name.indexOf(".");
    const domain = dot > 0 ? m.name.slice(0, dot) : "other";
    (groups[domain] ??= []).push(m);
  }
  const sorted: Record<string, MethodInfo[]> = {};
  for (const key of Object.keys(groups).toSorted()) {
    sorted[key] = groups[key].toSorted((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
}
