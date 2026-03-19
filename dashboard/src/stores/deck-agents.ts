import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentDetail {
  id: string;
  name: string;
  emoji?: string;
  model?: string;
  workspace?: string;
  isDefault?: boolean;
  stats?: {
    bindingCount: number;
    skillCount: number;
    subagentCount: number;
    activeSessionCount: number;
    activeRunCount: number;
  };
}

export interface AgentSkills {
  mode: "all" | "whitelist";
  whitelist: string[];
}

export interface AgentSubagentConfig {
  allowMode: "none" | "list" | "any";
  allowAgents: string[];
  model?: string;
  effectiveMaxDepth?: number;
  effectiveMaxChildren?: number;
}

// ---------------------------------------------------------------------------
// TTL cache
// ---------------------------------------------------------------------------

const TTL_MS = 60_000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface DeckAgentsState {
  _cache: Map<string, CacheEntry<AgentDetail>>;
  currentDetail: AgentDetail | null;
  currentSkills: AgentSkills | null;
  currentSubagentConfig: AgentSubagentConfig | null;
  loading: boolean;
  error: string | null;

  fetchDetail: (agentId: string, force?: boolean) => Promise<void>;
  fetchSkills: (agentId: string) => Promise<void>;
  updateSkills: (agentId: string, skills: AgentSkills, baseHash: string) => Promise<boolean>;
  fetchSubagentConfig: (agentId: string) => Promise<void>;
  updateSubagentConfig: (
    agentId: string,
    config: AgentSubagentConfig,
    baseHash: string,
  ) => Promise<boolean>;
  invalidateCache: (agentId: string) => void;
}

export const useDeckAgentsStore = create<DeckAgentsState>((set, get) => ({
  _cache: new Map(),
  currentDetail: null,
  currentSkills: null,
  currentSubagentConfig: null,
  loading: false,
  error: null,

  fetchDetail: async (agentId: string, force = false) => {
    // Check TTL cache
    if (!force) {
      const cached = get()._cache.get(agentId);
      if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
        set({ currentDetail: cached.data, error: null });
        return;
      }
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/deck/agents?agentId=${encodeURIComponent(agentId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch agent detail" }));
        set({ error: (data as { error?: string }).error ?? "Failed to fetch agent detail" });
        return;
      }
      const detail = (await res.json()) as AgentDetail;
      const entry: CacheEntry<AgentDetail> = { data: detail, fetchedAt: Date.now() };
      const cache = new Map(get()._cache);
      cache.set(agentId, entry);
      set({ currentDetail: detail, _cache: cache });
    } catch {
      set({ error: "Failed to fetch agent detail" });
    } finally {
      set({ loading: false });
    }
  },

  fetchSkills: async (agentId: string) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skills.get", agentId }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as AgentSkills;
      set({ currentSkills: data });
    } catch {
      // ignore
    }
  },

  updateSkills: async (agentId, skills, baseHash) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skills.set", agentId, skills, baseHash }),
      });
      if (res.ok) {
        get().invalidateCache(agentId);
        await get().fetchSkills(agentId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  fetchSubagentConfig: async (agentId: string) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subagents.get", agentId }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as AgentSubagentConfig;
      set({ currentSubagentConfig: data });
    } catch {
      // ignore
    }
  },

  updateSubagentConfig: async (agentId, config, baseHash) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subagents.set", agentId, subagents: config, baseHash }),
      });
      if (res.ok) {
        get().invalidateCache(agentId);
        await get().fetchSubagentConfig(agentId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  invalidateCache: (agentId: string) => {
    const cache = new Map(get()._cache);
    cache.delete(agentId);
    set({ _cache: cache });
  },
}));
