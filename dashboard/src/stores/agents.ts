import { create } from "zustand";

export interface Agent {
  id: string;
  name: string;
  model: string;
  status: "idle" | "busy" | "error" | "offline";
}

const statusSet: Record<string, true> = { idle: true, busy: true, error: true, offline: true };

interface AgentsState {
  agents: Agent[];
  selectedAgentId: string | null;
  selectedIds: Set<string>;
  /** The default (main) agent ID returned by Gateway. */
  defaultAgentId: string | null;
  /** Pending tab hint consumed by AgentDetail on navigation. */
  pendingTab: string | null;
  /** When set, AgentsPanel shows the compare view with this agent pre-selected as left. */
  compareAgentId: string | null;
  loading: boolean;

  setAgents: (agents: Agent[]) => void;
  selectAgent: (id: string | null) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setPendingTab: (tab: string | null) => void;
  setCompareAgentId: (id: string | null) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  setLoading: (loading: boolean) => void;

  fetchAgents: () => Promise<void>;
  createAgent: (name: string) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  selectedIds: new Set(),
  defaultAgentId: null,
  pendingTab: null,
  compareAgentId: null,
  loading: false,

  setAgents: (agents) => set({ agents }),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  selectAll: () =>
    set((state) => ({ selectedIds: new Set(state.agents.map((agent) => agent.id)) })),
  setPendingTab: (pendingTab) => set({ pendingTab }),
  setCompareAgentId: (compareAgentId) => set({ compareAgentId }),
  updateAgent: (id, patch) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  setLoading: (loading) => set({ loading }),

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      // Gateway may return { agents: [...] } or an array directly.
      // Agent entries may be sparse (only `id`); fill in defaults for UI.
      const raw: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.agents)
          ? data.agents
          : [];
      const list: Agent[] = raw.map((a) => ({
        id: typeof a.id === "string" ? a.id : JSON.stringify(a.id ?? ""),
        name: typeof a.name === "string" ? a.name : typeof a.id === "string" ? a.id : "",
        model: typeof a.model === "string" ? a.model : "",
        status: (typeof a.status === "string" && a.status in statusSet
          ? a.status
          : "idle") as Agent["status"],
      }));
      const defaultAgentId = typeof data?.defaultId === "string" ? data.defaultId : null;
      set((state) => ({
        agents: list,
        defaultAgentId,
        selectedIds: new Set(
          [...state.selectedIds].filter((id) => list.some((agent) => agent.id === id)),
        ),
      }));
    } finally {
      set({ loading: false });
    }
  },

  createAgent: async (name: string) => {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await get().fetchAgents();
    }
  },

  deleteAgent: async (id: string) => {
    const res = await fetch(`/api/agents?agentId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const { selectedAgentId } = get();
      if (selectedAgentId === id) {
        set({ selectedAgentId: null });
      }
      set((state) => {
        const next = new Set(state.selectedIds);
        next.delete(id);
        return { selectedIds: next };
      });
      await get().fetchAgents();
    }
  },
}));
