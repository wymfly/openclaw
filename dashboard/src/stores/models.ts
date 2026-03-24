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

export interface AllowlistEntry {
  alias?: string;
  streaming?: boolean;
  params?: Record<string, unknown>;
}

export interface BedrockDiscoveryConfig {
  enabled?: boolean;
  region?: string;
  providerFilter?: string[];
  refreshInterval?: number;
  defaultContextWindow?: number;
  defaultMaxTokens?: number;
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

  // Model allowlist
  allowlist: Record<string, AllowlistEntry>;
  allowlistActive: boolean;

  // Bedrock discovery
  bedrockDiscovery: BedrockDiscoveryConfig;

  // Provider API format map (derived from config.models.providers)
  providerApiMap: Record<string, string>;

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
  toggleAllowlist: (active: boolean) => Promise<boolean>;
  toggleModelEnabled: (ref: string, enabled: boolean) => Promise<boolean>;
  updateModelAllowlistEntry: (ref: string, entry: Partial<AllowlistEntry>) => Promise<boolean>;
  updateBedrockDiscovery: (config: BedrockDiscoveryConfig) => Promise<boolean>;
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

function getNestedAllowlist(config: Record<string, unknown>): {
  active: boolean;
  entries: Record<string, AllowlistEntry>;
} {
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const models = defaults?.models;
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    return { active: false, entries: {} };
  }
  const m = models as Record<string, unknown>;
  const entries: Record<string, AllowlistEntry> = {};
  for (const [key, value] of Object.entries(m)) {
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      entries[key] = {
        alias: typeof v.alias === "string" ? v.alias : undefined,
        streaming: typeof v.streaming === "boolean" ? v.streaming : undefined,
        params:
          typeof v.params === "object" && v.params !== null
            ? (v.params as Record<string, unknown>)
            : undefined,
      };
    } else {
      entries[key] = {};
    }
  }
  // IMPORTANT: Empty object = backend treats as no allowlist (allowAny=true).
  // Match backend semantics: empty entries → inactive.
  if (Object.keys(entries).length === 0) {
    return { active: false, entries: {} };
  }
  return { active: true, entries };
}

function getNestedBedrockDiscovery(config: Record<string, unknown>): BedrockDiscoveryConfig {
  const models = config.models as Record<string, unknown> | undefined;
  const bd = models?.bedrockDiscovery as Record<string, unknown> | undefined;
  if (!bd) {
    return {};
  }
  return {
    enabled: typeof bd.enabled === "boolean" ? bd.enabled : undefined,
    region: typeof bd.region === "string" ? bd.region : undefined,
    providerFilter: Array.isArray(bd.providerFilter)
      ? (bd.providerFilter as string[]).filter((s) => typeof s === "string")
      : undefined,
    refreshInterval: typeof bd.refreshInterval === "number" ? bd.refreshInterval : undefined,
    defaultContextWindow:
      typeof bd.defaultContextWindow === "number" ? bd.defaultContextWindow : undefined,
    defaultMaxTokens: typeof bd.defaultMaxTokens === "number" ? bd.defaultMaxTokens : undefined,
  };
}

// Static fallback for implicit (built-in) providers not in config.models.providers.
const IMPLICIT_PROVIDER_API: Record<string, string> = {
  anthropic: "anthropic-messages",
  openai: "openai-responses",
  google: "google-generative-ai",
  "google-generative-ai": "google-generative-ai",
  "github-copilot": "github-copilot",
  "amazon-bedrock": "bedrock-converse-stream",
  bedrock: "bedrock-converse-stream",
  ollama: "ollama",
};

function getNestedProviderApiMap(config: Record<string, unknown>): Record<string, string> {
  // Start with implicit provider defaults
  const map: Record<string, string> = { ...IMPLICIT_PROVIDER_API };
  // Override with explicit config (user-defined providers take precedence)
  const models = config.models as Record<string, unknown> | undefined;
  const providers = models?.providers as Record<string, unknown> | undefined;
  if (providers) {
    for (const [name, value] of Object.entries(providers)) {
      if (typeof value === "object" && value !== null) {
        const api = (value as Record<string, unknown>).api;
        if (typeof api === "string") {
          map[name] = api;
        }
      }
    }
  }
  return map;
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
  allowlist: {},
  allowlistActive: false,
  bedrockDiscovery: {},
  providerApiMap: {},

  selectProvider: (selectedProvider) => set({ selectedProvider }),

  fetchModels: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const raw = Array.isArray(data) ? data : Array.isArray(data?.models) ? data.models : [];
      // Map API shape (cost.input/output) → store shape (inputPrice/outputPrice)
      const list: Model[] = raw.map((m: Record<string, unknown>) => {
        const cost = m.cost as Record<string, number> | undefined;
        return {
          id: m.id as string,
          name: (m.name as string) || (m.id as string),
          provider: m.provider as string,
          contextWindow: (m.contextWindow as number) ?? 0,
          inputPrice: cost?.input ?? (m.inputPrice as number) ?? 0,
          outputPrice: cost?.output ?? (m.outputPrice as number) ?? 0,
          cacheReadPrice: cost?.cacheRead ?? (m.cacheReadPrice as number),
          cacheWritePrice: cost?.cacheWrite ?? (m.cacheWritePrice as number),
          isDefault: m.isDefault as boolean | undefined,
          reasoning: m.reasoning as boolean | undefined,
          input: m.input as string[] | undefined,
          maxTokens: m.maxTokens as number | undefined,
        };
      });
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
        set({
          configRaw: null,
          configHash: null,
          primaryModel: null,
          fallbacks: [],
          allowlist: {},
          allowlistActive: false,
          bedrockDiscovery: {},
          providerApiMap: {},
        });
        return;
      }

      const { primary, fallbacks } = getNestedModel(config);
      const { primary: imagePrimary, fallbacks: imageFallbacks } = getNestedImageModel(config);
      const { active: allowlistActive, entries: allowlist } = getNestedAllowlist(config);
      const bedrockDiscovery = getNestedBedrockDiscovery(config);
      const providerApiMap = getNestedProviderApiMap(config);

      set({
        configRaw: raw,
        configHash: hash,
        primaryModel: primary,
        fallbacks,
        imagePrimaryModel: imagePrimary ?? null,
        imageFallbacks,
        allowlistActive,
        allowlist,
        bedrockDiscovery,
        providerApiMap,
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

  // Placeholder stubs — implemented in Task 2
  toggleAllowlist: async (_active: boolean) => Promise.resolve(false),
  toggleModelEnabled: async (_ref: string, _enabled: boolean) => Promise.resolve(false),
  updateModelAllowlistEntry: async (_ref: string, _entry: Partial<AllowlistEntry>) =>
    Promise.resolve(false),
  updateBedrockDiscovery: async (_config: BedrockDiscoveryConfig) => Promise.resolve(false),
}));
