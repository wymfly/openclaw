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
  sandbox?: unknown;
  identityExists?: boolean;
  fallbackModels?: string[];
}

export interface ToolPolicyLayer {
  label: string;
  ruleCount: number;
  effect: "allow" | "deny" | "passthrough";
}

export interface ToolPolicyTool {
  name: string;
  allowed: boolean;
  decisiveLayer: string;
  trace: Array<{ layer: string; decision: "allow" | "deny" | "no-opinion" }>;
}

export interface ToolPolicyPreview {
  layers: ToolPolicyLayer[];
  tools: ToolPolicyTool[];
  configHash: string;
}

export interface PromptLayer {
  label: string;
  source: string;
  charCount: number;
  fileCount?: number;
  content?: string;
}

export interface BootstrapFileEntry {
  name: string;
  exists: boolean;
  charCount: number;
}

export interface SystemPromptPreview {
  layers: PromptLayer[];
  bootstrapFiles: BootstrapFileEntry[];
  totalChars: number;
  configHash: string;
}

export interface BootstrapFileDetail {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
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
  /** Explicit whitelist of skill keys when mode is "whitelist". */
  whitelist: string[];
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
  /** Spawn permission mode: none / list / any. Derived from allowAny + allowAgents. */
  allowMode: "none" | "list" | "any";
  /** Alias for effectiveMaxSpawnDepth. */
  effectiveMaxDepth: number;
  /** Alias for effectiveMaxChildrenPerAgent. */
  effectiveMaxChildren: number;
}

export interface AgentEventStreamsConfig {
  eventStreams: string[];
  isDefault: boolean;
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
  currentEventStreams: AgentEventStreamsConfig | null;
  toolPolicyPreview: ToolPolicyPreview | null;
  systemPromptPreview: SystemPromptPreview | null;
  bootstrapFileDetail: BootstrapFileDetail | null;
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
    configOrAllowAgents: string[] | { allowMode?: string; allowAgents?: string[]; model?: string },
    modelOrBaseHash?: string | null,
    baseHash?: string,
  ) => Promise<boolean>;
  fetchEventStreams: (agentId: string) => Promise<void>;
  setEventStreams: (agentId: string, eventStreams: string[], baseHash: string) => Promise<boolean>;
  fetchToolPolicyPreview: (agentId: string) => Promise<void>;
  fetchSystemPromptPreview: (agentId: string) => Promise<void>;
  fetchBootstrapFile: (agentId: string, name: string) => Promise<void>;
  saveBootstrapFile: (agentId: string, name: string, content: string) => Promise<boolean>;
  patchAgentConfig: (agentId: string, path: string, value: unknown) => Promise<boolean>;
  invalidateCache: (agentId: string) => void;
}

export const useDeckAgentsStore = create<DeckAgentsState>((set, get) => ({
  _cache: new Map(),
  currentDetail: null,
  currentSkills: null,
  currentSubagentConfig: null,
  currentEventStreams: null,
  toolPolicyPreview: null,
  systemPromptPreview: null,
  bootstrapFileDetail: null,
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

  updateSubagentConfig: async (agentId, configOrAllowAgents, modelOrBaseHash, baseHash) => {
    // Support both calling conventions:
    //   (agentId, allowAgents[], model, baseHash) — legacy
    //   (agentId, { allowMode, allowAgents, model }, baseHash) — object-based
    let resolvedAllowAgents: string[];
    let resolvedModel: string | null | undefined;
    let resolvedBaseHash: string;

    if (Array.isArray(configOrAllowAgents)) {
      resolvedAllowAgents = configOrAllowAgents;
      resolvedModel = modelOrBaseHash;
      resolvedBaseHash = baseHash ?? "";
    } else {
      resolvedAllowAgents = configOrAllowAgents.allowAgents ?? [];
      resolvedModel = configOrAllowAgents.model;
      resolvedBaseHash = typeof modelOrBaseHash === "string" ? modelOrBaseHash : "";
    }

    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subagents.set",
          agentId,
          allowAgents: resolvedAllowAgents,
          ...(resolvedModel !== undefined ? { model: resolvedModel } : {}),
          baseHash: resolvedBaseHash,
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

  fetchEventStreams: async (agentId: string) => {
    // [enhanced] Clear stale data before fetch to prevent showing previous agent's config
    set({ currentEventStreams: null });
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "eventStreams.get", agentId }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as AgentEventStreamsConfig;
      set({ currentEventStreams: data });
    } catch {
      // ignore
    }
  },

  setEventStreams: async (agentId, eventStreams, baseHash) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "eventStreams.set", agentId, eventStreams, baseHash }),
      });
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as { ok: boolean; configHash: string };
      set({
        currentEventStreams: {
          eventStreams,
          isDefault: false,
          configHash: data.configHash,
        },
      });
      return true;
    } catch {
      set({ error: String("Failed to set event streams") });
      return false;
    }
  },

  fetchToolPolicyPreview: async (agentId: string) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toolPolicy.preview", agentId }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as ToolPolicyPreview;
      set({ toolPolicyPreview: data });
    } catch {
      // ignore
    }
  },

  fetchSystemPromptPreview: async (agentId: string) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "systemPrompt.preview", agentId }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as SystemPromptPreview;
      set({ systemPromptPreview: data });
    } catch {
      // ignore
    }
  },

  fetchBootstrapFile: async (agentId: string, name: string) => {
    try {
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(name)}`,
      );
      if (!res.ok) {
        set({ bootstrapFileDetail: null });
        return;
      }
      const data = (await res.json()) as { file: BootstrapFileDetail };
      set({ bootstrapFileDetail: data.file });
    } catch {
      set({ bootstrapFileDetail: null });
    }
  },

  saveBootstrapFile: async (agentId: string, name: string, content: string) => {
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  patchAgentConfig: async (agentId: string, path: string, value: unknown) => {
    set({ error: null });
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config.patch", agentId, path, value }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        set({ error: d.error ?? "Failed to update config" });
        return false;
      }
      const { fetchDetail } = get();
      if (agentId) await fetchDetail(agentId, true);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Network error" });
      return false;
    }
  },

  invalidateCache: (agentId: string) => {
    const cache = new Map(get()._cache);
    cache.delete(agentId);
    set({ _cache: cache });
  },
}));
