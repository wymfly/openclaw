import { create } from "zustand";
import { fetchApi } from "@/lib/errors";

const FETCH_PLUGINS_ERROR = "Failed to fetch plugins";
const DEFAULT_SCOPE = "channel";

export type InventoryWizardSpec = {
  steps: Array<Record<string, unknown>>;
  onComplete: {
    action: string;
    params?: Record<string, unknown>;
  };
};

export type InventoryPluginLocaleBundle = Record<string, Record<string, unknown>>;

export type InventoryDeckActionCapabilities = {
  login?: boolean;
  probe?: boolean;
  testMessage?: boolean;
  qrCodeAuth?: boolean;
};

type PluginsInventoryResponse = {
  scope?: string;
  plugins?: InventoryPluginEntry[];
};

export interface InventoryPluginEntry {
  id: string;
  name: string;
  version?: string;
  origin: string;
  status: string;
  enabled: boolean;
  explicitlyEnabled?: boolean;
  activated?: boolean;
  imported?: boolean;
  activationSource?: string;
  activationReason?: string;
  configPath: string;
  capabilityKinds: string[];
  channelIds: string[];
  providerIds: string[];
  toolNames: string[];
  setupWizardSpec?: InventoryWizardSpec;
  locales?: InventoryPluginLocaleBundle;
  deckActionCapabilities?: InventoryDeckActionCapabilities;
  diagnostics: Array<{
    level: string;
    message: string;
  }>;
}

interface PluginsInventoryState {
  loading: boolean;
  error: string | null;
  scope: string;
  plugins: InventoryPluginEntry[];
  selectedId: string | null;
  fetchPlugins: (options?: { capability?: "channel" | "all" }) => Promise<void>;
  selectPlugin: (pluginId: string | null) => void;
}

function getPluginsInventoryUrl(capability?: "channel" | "all"): string {
  return capability === "all" ? "/api/deck/plugins?capability=all" : "/api/deck/plugins";
}

export const usePluginsStore = create<PluginsInventoryState>((set) => ({
  loading: false,
  error: null,
  scope: DEFAULT_SCOPE,
  plugins: [],
  selectedId: null,
  fetchPlugins: async (options) => {
    set({ loading: true, error: null });
    try {
      const data = await fetchApi<PluginsInventoryResponse>(
        getPluginsInventoryUrl(options?.capability),
      );
      set({
        scope: data.scope ?? DEFAULT_SCOPE,
        plugins: Array.isArray(data.plugins) ? data.plugins : [],
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : FETCH_PLUGINS_ERROR,
      });
    } finally {
      set({ loading: false });
    }
  },
  selectPlugin: (selectedId) => set({ selectedId }),
}));
