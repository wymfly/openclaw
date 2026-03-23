import { create } from "zustand";

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputPrice: number; // per million tokens
  outputPrice: number; // per million tokens
  isDefault?: boolean;
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
}

interface ModelsState {
  models: Model[];
  providers: ProviderConfig[];
  selectedProvider: string | null;
  loading: boolean;

  // Auth & fallback state
  authOverview: AuthOverviewEntry[];
  primaryModel: string | null;
  fallbacks: string[];
  imagePrimaryModel: string | null;
  imageFallbacks: string[];

  selectProvider: (provider: string | null) => void;
  fetchModels: () => Promise<void>;
  fetchProviderConfig: () => Promise<void>;
  updateProviderConfig: (config: ProviderConfig) => Promise<boolean>;
  fetchAuthOverview: () => Promise<void>;
  fetchFallbacks: () => Promise<void>;
  updateFallbacks: (primary: string, fallbacks: string[]) => Promise<boolean>;
  updateImageFallbacks: (primary: string, fallbacks: string[]) => Promise<boolean>;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  providers: [],
  selectedProvider: null,
  loading: false,

  authOverview: [],
  primaryModel: null,
  fallbacks: [],
  imagePrimaryModel: null,
  imageFallbacks: [],

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
    try {
      const res = await fetch("/api/models/auth");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const providers = Array.isArray(data?.providers) ? data.providers : [];
      set({ authOverview: providers });
    } catch {
      // best-effort
    }
  },

  fetchFallbacks: async () => {
    try {
      // Use the default agent's detail to read primary model + fallbacks.
      const res = await fetch("/api/deck/agents?agentId=main");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      set({
        primaryModel: typeof data.model === "string" ? data.model : null,
        fallbacks: Array.isArray(data.fallbackModels) ? data.fallbackModels : [],
      });
    } catch {
      // best-effort
    }
  },

  // TODO: updateFallbacks requires YAML config editing (config.get → modify → config.patch)
  updateFallbacks: async (_primary, _fallbacks) => {
    return false;
  },

  updateImageFallbacks: async (_primary, _fallbacks) => {
    return false;
  },
}));
