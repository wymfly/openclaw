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
  /** The default (main) agent ID returned by Gateway. */
  defaultAgentId: string | null;
  /** Pending tab hint consumed by AgentDetail on navigation. */
  pendingTab: string | null;
  loading: boolean;

  setAgents: (agents: Agent[]) => void;
  selectAgent: (id: string | null) => void;
  setPendingTab: (tab: string | null) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  setLoading: (loading: boolean) => void;

  fetchAgents: () => Promise<void>;
  createAgent: (name: string) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  defaultAgentId: null,
  pendingTab: null,
  loading: false,

  setAgents: (agents) => set({ agents }),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
  setPendingTab: (pendingTab) => set({ pendingTab }),
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
      set({ agents: list, defaultAgentId });
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
      await get().fetchAgents();
    }
  },
}));
