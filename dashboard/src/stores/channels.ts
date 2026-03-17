import { create } from "zustand";

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
// Store
// ---------------------------------------------------------------------------

interface ChannelsState {
  channels: Map<string, ChannelInfo>;
  channelOrder: string[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;

  fetchChannels: () => Promise<void>;
  selectChannel: (id: string | null) => void;
  updateChannelConfig: (channelId: string, patch: Record<string, unknown>) => Promise<boolean>;
  logoutChannel: (channelId: string) => Promise<boolean>;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: new Map(),
  channelOrder: [],
  selectedId: null,
  loading: false,
  error: null,

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
}));
