import { create } from "zustand";

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputPrice: number; // per million tokens
  outputPrice: number; // per million tokens
  isDefault?: boolean;
  /** Cache read price per million tokens. */
  cacheReadPrice?: number;
  /** Cache write price per million tokens. */
  cacheWritePrice?: number;
  /** Whether the model supports reasoning/thinking. */
  reasoning?: boolean;
  /** Supported input modalities (e.g. ["text", "image"]). */
  input?: string[];
  /** Maximum output tokens. */
  maxTokens?: number;
}

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}

export interface AuthOverviewEntry {
  provider: string;
  status: "ready" | "warning" | "missing" | "unknown";
  auth: {
    type: "api_key" | "oauth" | "token" | "aws-sdk" | null;
    source: string;
  } | null;
  oauth?: {
    expiresAt: number;
    remainingMs: number;
    status: "ok" | "expiring" | "expired" | "missing";
  };
  cooldown?: {
    remainingMs: number;
    until: number;
    reason: string;
  };
}

export interface ProbeResult {
  provider: string;
  status: "ok" | "error" | "auth";
  latencyMs?: number;
  error?: string;
  model?: string;
  profileId?: string;
}

export interface DailyCost {
  date: string;
  cost: number;
}

export interface UsageProviderStatus {
  provider: string;
  displayName: string;
  plan?: string;
  error?: string;
  windows: Array<{
    label: string;
    usedPercent: number;
    resetsInMs: number;
  }>;
}

interface ModelsState {
  models: Model[];
  providers: ProviderConfig[];
  selectedProvider: string | null;
  loading: boolean;

  // Auth & fallback state
  authOverview: AuthOverviewEntry[];
  authLoading: boolean;
  primaryModel: string | null;
  fallbacks: string[];
  imagePrimaryModel: string | null;
  imageFallbacks: string[];

  // Probe results
  probeResults: Record<string, ProbeResult>;

  // Raw config (for config-edit operations like updateFallbacks)
  configRaw: string | null;
  configHash: string | null;

  // Usage state
  usageCost: DailyCost[];
  usageProviders: UsageProviderStatus[];

  selectProvider: (provider: string | null) => void;
  fetchModels: () => Promise<void>;
  fetchProviderConfig: () => Promise<void>;
  updateProviderConfig: (config: ProviderConfig) => Promise<boolean>;
  fetchAuthOverview: () => Promise<void>;
  fetchFallbacks: () => Promise<void>;
  updateFallbacks: (primary: string, fallbacks: string[]) => Promise<boolean>;
  updateImageFallbacks: (primary: string, fallbacks: string[]) => Promise<boolean>;
  runProbe: (provider: string) => Promise<ProbeResult | null>;
  addCustomProvider: (params: {
    name: string;
    baseUrl?: string;
    apiKey?: string;
  }) => Promise<boolean>;
  fetchUsageSummary: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Config editing helpers
// ---------------------------------------------------------------------------

function parseConfig(raw: string | null): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getNestedModel(config: Record<string, unknown>): {
  primary: string | null;
  fallbacks: string[];
} {
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const model = defaults?.model;
  if (!model) {
    return { primary: null, fallbacks: [] };
  }
  if (typeof model === "string") {
    return { primary: model, fallbacks: [] };
  }
  const m = model as Record<string, unknown>;
  return {
    primary: typeof m.primary === "string" ? m.primary : null,
    fallbacks: Array.isArray(m.fallbacks)
      ? (m.fallbacks as string[]).filter((f) => typeof f === "string")
      : [],
  };
}

function getNestedImageModel(config: Record<string, unknown>): {
  primary: string | null;
  fallbacks: string[];
} {
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const imageModel = defaults?.imageModel;
  if (!imageModel) {
    return { primary: null, fallbacks: [] };
  }
  if (typeof imageModel === "string") {
    return { primary: imageModel, fallbacks: [] };
  }
  const m = imageModel as Record<string, unknown>;
  return {
    primary: typeof m.primary === "string" ? m.primary : null,
    fallbacks: Array.isArray(m.fallbacks)
      ? (m.fallbacks as string[]).filter((f) => typeof f === "string")
      : [],
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  providers: [],
  selectedProvider: null,
  loading: false,

  authOverview: [],
  authLoading: false,
  primaryModel: null,
  fallbacks: [],
  imagePrimaryModel: null,
  imageFallbacks: [],
  probeResults: {},
  configRaw: null,
  configHash: null,
  usageCost: [],
  usageProviders: [],

  selectProvider: (selectedProvider) => set({ selectedProvider }),

  fetchModels: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.models) ? data.models : [];
      set({ models: list });
    } finally {
      set({ loading: false });
    }
  },

  fetchProviderConfig: async () => {
    try {
      const res = await fetch("/api/models/config");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.providers)
          ? data.providers
          : [];
      set({ providers: list });
    } catch {
      // ignore
    }
  },

  updateProviderConfig: async (config: ProviderConfig) => {
    const res = await fetch("/api/models/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      await get().fetchProviderConfig();
      return true;
    }
    return false;
  },

  fetchAuthOverview: async () => {
    set({ authLoading: true });
    try {
      const res = await fetch("/api/models/auth");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      // Handle both { providers: [...] } and plain array responses
      const providers = Array.isArray(data)
        ? data
        : Array.isArray(data?.providers)
          ? data.providers
          : [];
      set({ authOverview: providers });
    } catch {
      // best-effort
    } finally {
      set({ authLoading: false });
    }
  },

  fetchFallbacks: async () => {
    try {
      const res = await fetch("/api/models/config");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const raw = typeof data.raw === "string" ? data.raw : null;
      const hash = typeof data.hash === "string" ? data.hash : null;

      const config = parseConfig(raw);
      if (!config) {
        set({ configRaw: null, configHash: null, primaryModel: null, fallbacks: [] });
        return;
      }

      const { primary, fallbacks } = getNestedModel(config);
      const { primary: imagePrimary, fallbacks: imageFallbacks } = getNestedImageModel(config);

      set({
        configRaw: raw,
        configHash: hash,
        primaryModel: primary,
        fallbacks,
        imagePrimaryModel: imagePrimary ?? null,
        imageFallbacks,
      });
    } catch {
      // best-effort
    }
  },

  updateFallbacks: async (primary, fallbacks) => {
    const state = get();
    if (!state.configRaw) {
      return false;
    }

    const config = parseConfig(state.configRaw);
    if (!config) {
      return false;
    }

    // Deep-merge: update only model.primary and model.fallbacks, preserve everything else
    const agents = (config.agents as Record<string, unknown> | undefined) ?? {};
    const defaults = (agents.defaults as Record<string, unknown> | undefined) ?? {};
    const existingModel = defaults.model as Record<string, unknown> | string | undefined;
    const modelObj =
      typeof existingModel === "object" && existingModel !== null ? existingModel : {};

    const updatedConfig = {
      ...config,
      agents: {
        ...agents,
        defaults: {
          ...defaults,
          model: {
            ...modelObj,
            primary,
            fallbacks,
          },
        },
      },
    };

    const body = JSON.stringify({
      raw: JSON.stringify(updatedConfig),
      baseHash: state.configHash,
    });

    try {
      const res = await fetch("/api/models/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.status === 409) {
        // Conflict — re-sync
        await get().fetchFallbacks();
        return false;
      }

      if (!res.ok) {
        return false;
      }

      // Refetch to confirm persisted state
      await get().fetchFallbacks();
      return true;
    } catch {
      return false;
    }
  },

  updateImageFallbacks: async (primary, fallbacks) => {
    const state = get();
    if (!state.configRaw) {
      return false;
    }

    const config = parseConfig(state.configRaw);
    if (!config) {
      return false;
    }

    const agents = (config.agents as Record<string, unknown> | undefined) ?? {};
    const defaults = (agents.defaults as Record<string, unknown> | undefined) ?? {};
    const existingImageModel = defaults.imageModel as Record<string, unknown> | string | undefined;
    const imageModelObj =
      typeof existingImageModel === "object" && existingImageModel !== null
        ? existingImageModel
        : {};

    const updatedConfig = {
      ...config,
      agents: {
        ...agents,
        defaults: {
          ...defaults,
          imageModel: {
            ...imageModelObj,
            primary,
            fallbacks,
          },
        },
      },
    };

    const body = JSON.stringify({
      raw: JSON.stringify(updatedConfig),
      baseHash: state.configHash,
    });

    try {
      const res = await fetch("/api/models/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.status === 409) {
        await get().fetchFallbacks();
        return false;
      }

      if (!res.ok) {
        return false;
      }

      await get().fetchFallbacks();
      return true;
    } catch {
      return false;
    }
  },

  runProbe: async (provider: string): Promise<ProbeResult | null> => {
    try {
      const res = await fetch("/api/models/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const errResult: ProbeResult = { provider, status: "error", error: "Probe failed" };
        set((s) => ({
          probeResults: { ...s.probeResults, [provider]: errResult },
        }));
        return errResult;
      }
      const data = (await res.json()) as ProbeResult;
      set((s) => ({
        probeResults: { ...s.probeResults, [provider]: data },
      }));
      return data;
    } catch {
      // Network error — return null without storing
      return null;
    }
  },

  addCustomProvider: async (params) => {
    try {
      const res = await fetch("/api/models/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        await get().fetchProviderConfig();
        await get().fetchAuthOverview();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  fetchUsageSummary: async () => {
    try {
      // Two parallel requests: cost history and provider status
      const [costRes, statusRes] = await Promise.all([
        fetch("/api/models/usage/cost"),
        fetch("/api/models/usage/providers"),
      ]);

      if (costRes.ok) {
        const data = await costRes.json();
        const costs = Array.isArray(data)
          ? data
          : Array.isArray(data?.costs)
            ? data.costs
            : Array.isArray(data?.dailyCosts)
              ? data.dailyCosts
              : [];
        set({ usageCost: costs });
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        const providers = Array.isArray(data)
          ? data
          : Array.isArray(data?.providers)
            ? data.providers
            : [];
        set({ usageProviders: providers });
      }
    } catch {
      // best-effort
    }
  },
}));
