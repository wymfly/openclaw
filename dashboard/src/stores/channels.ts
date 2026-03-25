import { create } from "zustand";
import { useConfigStore } from "./config";

// ---------------------------------------------------------------------------
// Types derived from channels.status gateway response
// ---------------------------------------------------------------------------

export interface ChannelAccount {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  lastError?: string;
}

export interface ChannelInfo {
  id: string;
  label: string;
  accounts: ChannelAccount[];
  defaultAccountId?: string;
}

// ---------------------------------------------------------------------------
// Throughput types
// ---------------------------------------------------------------------------

export type ThroughputWindow = "1h" | "6h" | "24h";

export interface ThroughputBucket {
  time: number;
  in: number;
  out: number;
}

export interface ThroughputData {
  buckets: ThroughputBucket[];
  messagesIn: number;
  messagesOut: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ChannelsState {
  channels: Map<string, ChannelInfo>;
  channelOrder: string[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;

  // Throughput state
  throughput: Map<string, ThroughputData>;
  throughputWindow: ThroughputWindow;

  // Channel config state (per-channel settings from raw config)
  channelConfig: Record<string, unknown> | null;

  fetchChannels: () => Promise<void>;
  selectChannel: (id: string | null) => void;
  updateChannelConfig: (channelId: string, patch: Record<string, unknown>) => Promise<boolean>;
  logoutChannel: (channelId: string) => Promise<boolean>;
  fetchThroughput: (channelId: string) => void;
  setThroughputWindow: (window: ThroughputWindow) => void;
  fetchChannelConfig: (channelId: string) => Promise<void>;
  saveChannelConfig: (channelId: string, patch: Record<string, unknown>) => Promise<boolean>;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: new Map(),
  channelOrder: [],
  selectedId: null,
  loading: false,
  error: null,
  throughput: new Map(),
  throughputWindow: "1h" as ThroughputWindow,
  channelConfig: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/channels");
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch channels" }));
        set({ error: (data as { error?: string }).error ?? "Failed to fetch channels" });
        return;
      }
      const data = await res.json();
      const order: string[] = Array.isArray(data.channelOrder) ? data.channelOrder : [];
      const labels: Record<string, string> = data.channelLabels ?? {};
      const rawChannels: Record<string, unknown> = data.channels ?? {};
      const rawAccounts: Record<string, Record<string, ChannelAccount>> = data.channelAccounts ??
      {};
      const defaultIds: Record<string, string> = data.channelDefaultAccountId ?? {};

      const channelMap = new Map<string, ChannelInfo>();

      for (const chId of order) {
        const accountsObj = rawAccounts[chId] ?? {};
        const accounts: ChannelAccount[] = Object.values(accountsObj);

        channelMap.set(chId, {
          id: chId,
          label: labels[chId] ?? chId,
          accounts,
          defaultAccountId: defaultIds[chId],
        });
      }

      // Also add any channels not in order (from rawChannels keys)
      for (const chId of Object.keys(rawChannels)) {
        if (!channelMap.has(chId)) {
          const accountsObj = rawAccounts[chId] ?? {};
          const accounts: ChannelAccount[] = Object.values(accountsObj);
          channelMap.set(chId, {
            id: chId,
            label: labels[chId] ?? chId,
            accounts,
            defaultAccountId: defaultIds[chId],
          });
          order.push(chId);
        }
      }

      set({ channels: channelMap, channelOrder: order });
    } catch {
      set({ error: "Failed to fetch channels" });
    } finally {
      set({ loading: false });
    }
  },

  selectChannel: (selectedId) => set({ selectedId }),

  updateChannelConfig: async (channelId, patch) => {
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        await get().fetchChannels();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logoutChannel: async (channelId) => {
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/logout`, {
        method: "POST",
      });
      if (res.ok) {
        await get().fetchChannels();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  fetchThroughput: (channelId: string) => {
    const window = get().throughputWindow;
    void (async () => {
      try {
        const res = await fetch(
          `/api/channels/${encodeURIComponent(channelId)}/throughput?window=${window}`,
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ThroughputData;
        const map = new Map(get().throughput);
        map.set(channelId, data);
        set({ throughput: map });
      } catch {
        // best-effort
      }
    })();
  },

  setThroughputWindow: (window: ThroughputWindow) => set({ throughputWindow: window }),

  fetchChannelConfig: async (channelId: string) => {
    const configStore = useConfigStore.getState();
    // Ensure rawConfig is loaded
    if (!configStore.rawConfig) {
      await configStore.fetchConfig();
    }
    const { rawConfig } = useConfigStore.getState();
    if (!rawConfig) {
      set({ channelConfig: null });
      return;
    }
    try {
      const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
      const channels = (parsed.channels ?? {}) as Record<string, unknown>;
      const channelCfg = (channels[channelId] ?? {}) as Record<string, unknown>;
      set({ channelConfig: channelCfg });
    } catch {
      set({ channelConfig: null });
    }
  },

  saveChannelConfig: async (channelId: string, patch: Record<string, unknown>) => {
    const configStore = useConfigStore.getState();
    const baseHash = configStore.baseHash;
    try {
      const res = await fetch("/api/config/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch: { channels: { [channelId]: patch } },
          baseHash,
        }),
      });
      if (res.ok) {
        // Refresh config store to get new baseHash
        await configStore.fetchConfig();
        // Refresh channel config from updated rawConfig
        await get().fetchChannelConfig(channelId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
