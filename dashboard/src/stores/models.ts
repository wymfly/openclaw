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

interface ModelsState {
  models: Model[];
  providers: ProviderConfig[];
  selectedProvider: string | null;
  loading: boolean;

  selectProvider: (provider: string | null) => void;
  fetchModels: () => Promise<void>;
  fetchProviderConfig: () => Promise<void>;
  updateProviderConfig: (config: ProviderConfig) => Promise<boolean>;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  providers: [],
  selectedProvider: null,
  loading: false,

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
}));
