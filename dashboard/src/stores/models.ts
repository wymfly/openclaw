import { create } from "zustand";

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputPrice: number; // per million tokens
  outputPrice: number; // per million tokens
  isDefault?: boolean;
  reasoning?: boolean;
  input?: string[]; // ["text", "image"]
  maxTokens?: number;
  cacheReadPrice?: number;
  cacheWritePrice?: number;
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
    profileId?: string;
  } | null;
  oauth?: { expiresAt: number; remainingMs: number; status: string };
  cooldown?: { reason: string; remainingMs: number; until: number };
  usage?: {
    windows: Array<{ label: string; usedPercent: number; resetsInMs: number }>;
    plan?: string;
  };
}

export interface ProbeResult {
  provider: string;
  profileId?: string;
  status: string;
  latencyMs: number;
  error?: string;
  model?: string;
}

export interface DailyCost {
  date: string;
  cost: number;
}

export interface UsageProviderStatus {
  provider: string;
  displayName: string;
  windows: Array<{ label: string; usedPercent: number; resetsInMs: number }>;
  plan?: string;
  error?: string;
}

interface ModelsState {
  models: Model[];
  providers: ProviderConfig[];
  selectedProvider: string | null;
  loading: boolean;

  // Auth overview
  authOverview: AuthOverviewEntry[];
  authLoading: boolean;

  // Probe results keyed by provider for Zustand reactivity
  probeResults: Record<string, ProbeResult>;

  // Fallback configuration
  primaryModel: string | null;
  fallbacks: string[];
  imagePrimaryModel: string | null;
  imageFallbacks: string[];

  // Usage
  usageCost: DailyCost[];
  usageProviders: UsageProviderStatus[];

  // Config snapshot for optimistic concurrency
  configRaw: string | null;
  configHash: string | null;

  // Existing actions
  selectProvider: (provider: string | null) => void;
  fetchModels: () => Promise<void>;
  fetchProviderConfig: () => Promise<void>;
  updateProviderConfig: (config: ProviderConfig) => Promise<boolean>;

  // New actions
  fetchAuthOverview: () => Promise<void>;
  runProbe: (provider: string) => Promise<ProbeResult | null>;
  fetchFallbacks: () => Promise<void>;
  updateFallbacks: (primary: string, fallbacks: string[]) => Promise<boolean>;
  updateImageFallbacks: (primary: string, fallbacks: string[]) => Promise<boolean>;
  fetchUsageSummary: () => Promise<void>;
}

/**
 * Extract model defaults from a parsed config object.
 * Handles both string form ("provider/model") and object form ({ primary, fallbacks }).
 */
function extractModelDefaults(
  config: Record<string, unknown>,
  key: "model" | "imageModel",
): { primary: string | null; fallbacks: string[] } {
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const value = defaults?.[key];

  if (typeof value === "string") {
    return { primary: value, fallbacks: [] };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return {
      primary: typeof obj.primary === "string" ? obj.primary : null,
      fallbacks: Array.isArray(obj.fallbacks) ? (obj.fallbacks as string[]) : [],
    };
  }
  return { primary: null, fallbacks: [] };
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  providers: [],
  selectedProvider: null,
  loading: false,

  authOverview: [],
  authLoading: false,
  probeResults: {},
  primaryModel: null,
  fallbacks: [],
  imagePrimaryModel: null,
  imageFallbacks: [],
  usageCost: [],
  usageProviders: [],
  configRaw: null,
  configHash: null,

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
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.providers)
          ? data.providers
          : [];
      set({ authOverview: list });
    } finally {
      set({ authLoading: false });
    }
  },

  runProbe: async (provider: string) => {
    try {
      const res = await fetch("/api/models/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        return null;
      }
      const result: ProbeResult = await res.json();
      set({
        probeResults: { ...get().probeResults, [provider]: result },
      });
      return result;
    } catch {
      return null;
    }
  },

  fetchFallbacks: async () => {
    try {
      const res = await fetch("/api/models/config");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const raw: string | undefined = data?.raw;
      const hash: string | undefined = data?.hash;

      if (typeof raw !== "string") {
        return;
      }

      const config = JSON.parse(raw) as Record<string, unknown>;
      const modelDefaults = extractModelDefaults(config, "model");
      const imageDefaults = extractModelDefaults(config, "imageModel");

      set({
        configRaw: raw,
        configHash: hash ?? null,
        primaryModel: modelDefaults.primary,
        fallbacks: modelDefaults.fallbacks,
        imagePrimaryModel: imageDefaults.primary,
        imageFallbacks: imageDefaults.fallbacks,
      });
    } catch {
      // ignore parse errors
    }
  },

  updateFallbacks: async (primary: string, fallbacks: string[]) => {
    const { configRaw, configHash } = get();
    if (configRaw == null) {
      return false;
    }

    try {
      const config = JSON.parse(configRaw) as Record<string, unknown>;
      // Ensure nested path exists
      if (!config.agents || typeof config.agents !== "object") {
        config.agents = {};
      }
      const agents = config.agents as Record<string, unknown>;
      if (!agents.defaults || typeof agents.defaults !== "object") {
        agents.defaults = {};
      }
      const defaults = agents.defaults as Record<string, unknown>;
      defaults.model = { primary, fallbacks };

      const newRaw = JSON.stringify(config, null, 2);
      const res = await fetch("/api/models/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: newRaw, baseHash: configHash }),
      });

      if (res.ok) {
        const data = await res.json();
        set({
          configRaw: data?.raw ?? newRaw,
          configHash: data?.hash ?? null,
          primaryModel: primary,
          fallbacks,
        });
        return true;
      }

      // 409 conflict — re-sync
      if (res.status === 409) {
        await get().fetchFallbacks();
      }
      return false;
    } catch {
      return false;
    }
  },

  updateImageFallbacks: async (primary: string, fallbacks: string[]) => {
    const { configRaw, configHash } = get();
    if (configRaw == null) {
      return false;
    }

    try {
      const config = JSON.parse(configRaw) as Record<string, unknown>;
      if (!config.agents || typeof config.agents !== "object") {
        config.agents = {};
      }
      const agents = config.agents as Record<string, unknown>;
      if (!agents.defaults || typeof agents.defaults !== "object") {
        agents.defaults = {};
      }
      const defaults = agents.defaults as Record<string, unknown>;
      defaults.imageModel = { primary, fallbacks };

      const newRaw = JSON.stringify(config, null, 2);
      const res = await fetch("/api/models/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: newRaw, baseHash: configHash }),
      });

      if (res.ok) {
        const data = await res.json();
        set({
          configRaw: data?.raw ?? newRaw,
          configHash: data?.hash ?? null,
          imagePrimaryModel: primary,
          imageFallbacks: fallbacks,
        });
        return true;
      }

      if (res.status === 409) {
        await get().fetchFallbacks();
      }
      return false;
    } catch {
      return false;
    }
  },

  fetchUsageSummary: async () => {
    try {
      const [costRes, statusRes] = await Promise.all([
        fetch("/api/usage/cost?days=7"),
        fetch("/api/usage/status"),
      ]);

      if (costRes.ok) {
        const costData = await costRes.json();
        const costList = Array.isArray(costData)
          ? costData
          : Array.isArray(costData?.costs)
            ? costData.costs
            : [];
        set({ usageCost: costList });
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const providerList = Array.isArray(statusData)
          ? statusData
          : Array.isArray(statusData?.providers)
            ? statusData.providers
            : [];
        set({ usageProviders: providerList });
      }
    } catch {
      // ignore
    }
  },
}));
