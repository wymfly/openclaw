import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentDetail {
  id: string;
  name: string;
  model?: string;
  workspace?: string;
  isDefault?: boolean;
  bindingCount: number;
  sessionCount: number;
  activeSubagentCount: number;
  skillMode: "all" | "whitelist";
  effectiveSkills: string[];
  totalAvailableSkills: number;
  subagents: {
    allowAgents: string[];
    model?: string;
    effectiveMaxSpawnDepth: number;
    effectiveMaxChildrenPerAgent: number;
  };
}

export interface SkillEntry {
  key: string;
  name: string;
  eligible: boolean;
  assigned: boolean;
}

export interface AgentSkills {
  agentId: string;
  mode: "all" | "whitelist";
  skills: string[];
  available: SkillEntry[];
  configHash: string;
}

export interface AgentSubagentConfig {
  agentId: string;
  allowAgents: string[];
  allowAny: boolean;
  model?: string;
  effectiveMaxSpawnDepth: number;
  effectiveMaxChildrenPerAgent: number;
  effectiveThinking?: unknown;
  allowedAgents: Array<{ id: string; name?: string }>;
  allAgents: Array<{ id: string; name?: string }>;
  configHash: string;
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
  updateSkills: (
    agentId: string,
    mode: "all" | "whitelist",
    skills: string[],
    baseHash: string,
  ) => Promise<boolean>;
  fetchSubagentConfig: (agentId: string) => Promise<void>;
  updateSubagentConfig: (
    agentId: string,
    allowAgents: string[],
    model: string | null | undefined,
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

  updateSkills: async (agentId, mode, skills, baseHash) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skills.set", agentId, mode, skills, baseHash }),
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

  updateSubagentConfig: async (agentId, allowAgents, model, baseHash) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subagents.set",
          agentId,
          allowAgents,
          ...(model !== undefined ? { model } : {}),
          baseHash,
        }),
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
