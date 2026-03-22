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
// Throughput types
// ---------------------------------------------------------------------------

export interface ThroughputBucket {
  time: number;
  in: number;
  out: number;
}

export interface ThroughputData {
  messagesIn: number;
  messagesOut: number;
  buckets: ThroughputBucket[];
}

export type ThroughputWindow = "1h" | "6h" | "24h";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ChannelsState {
  channels: Map<string, ChannelInfo>;
  channelOrder: string[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;

  // Throughput
  throughput: Map<string, ThroughputData>;
  throughputWindow: ThroughputWindow;

  fetchChannels: () => Promise<void>;
  selectChannel: (id: string | null) => void;
  updateChannelConfig: (
    channelId: string,
    patch: Record<string, unknown>,
    accountId?: string,
  ) => Promise<boolean>;
  removeAccount: (channelId: string, accountId: string) => Promise<boolean>;
  logoutChannel: (channelId: string) => Promise<boolean>;
  fetchThroughput: (channelId: string) => void;
  setThroughputWindow: (window: ThroughputWindow) => void;
}

// ---------------------------------------------------------------------------
// Throughput helpers — generate simulated data from activity events or mock
// ---------------------------------------------------------------------------

const BUCKET_COUNTS: Record<ThroughputWindow, number> = {
  "1h": 12,
  "6h": 12,
  "24h": 24,
};

const WINDOW_MS: Record<ThroughputWindow, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

function generateThroughputBuckets(window: ThroughputWindow): ThroughputData {
  const now = Date.now();
  const count = BUCKET_COUNTS[window];
  const windowMs = WINDOW_MS[window];
  const bucketMs = windowMs / count;

  const buckets: ThroughputBucket[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let i = 0; i < count; i++) {
    const time = now - windowMs + bucketMs * i + bucketMs / 2;
    // Simulated data — varies per bucket for visual interest
    const inCount = Math.floor(Math.random() * 8);
    const outCount = Math.floor(Math.random() * 6);
    totalIn += inCount;
    totalOut += outCount;
    buckets.push({ time, in: inCount, out: outCount });
  }

  return { messagesIn: totalIn, messagesOut: totalOut, buckets };
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: new Map(),
  channelOrder: [],
  selectedId: null,
  loading: false,
  error: null,
  throughput: new Map(),
  throughputWindow: "1h",

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

  updateChannelConfig: async (channelId, patch, accountId) => {
    try {
      const body: Record<string, unknown> = { ...patch };
      if (accountId) {
        body.accountId = accountId;
      }
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  removeAccount: async (channelId, accountId) => {
    try {
      // Remove account by patching with a null/remove marker
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, enabled: false, _remove: true }),
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

  fetchThroughput: (channelId) => {
    // Generate simulated throughput — activity events lack channel info
    const window = get().throughputWindow;
    const data = generateThroughputBuckets(window);
    set((state) => {
      const next = new Map(state.throughput);
      next.set(channelId, data);
      return { throughput: next };
    });
  },

  setThroughputWindow: (window) => {
    set({ throughputWindow: window });
    // Re-fetch throughput for all known channels
    const { channels } = get();
    for (const chId of channels.keys()) {
      get().fetchThroughput(chId);
    }
  },
}));
