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
  /** Probe result from channels.status with probe: true */
  probe?: { ok?: boolean; error?: string; latencyMs?: number; elapsedMs?: number };
  lastProbeAt?: number | null;
}

export interface ChannelInfo {
  id: string;
  label: string;
  detailLabel?: string;
  systemImage?: string;
  pluginId?: string;
  pluginOrigin?: string;
  pluginNpmSpec?: string;
  pluginLocalPath?: string;
  pluginDefaultInstallChoice?: "npm" | "local";
  pluginConfigPath?: string;
  accounts: ChannelAccount[];
  defaultAccountId?: string;
}

interface ChannelUiMeta {
  id: string;
  label: string;
  detailLabel?: string;
  systemImage?: string;
  pluginId?: string;
  pluginOrigin?: string;
  pluginNpmSpec?: string;
  pluginLocalPath?: string;
  pluginDefaultInstallChoice?: "npm" | "local";
  pluginConfigPath?: string;
}

function buildChannelInfo(params: {
  channelId: string;
  labels: Record<string, string>;
  detailLabels: Record<string, string>;
  systemImages: Record<string, string>;
  defaultIds: Record<string, string>;
  rawAccounts: Record<string, Record<string, ChannelAccount>>;
  metaById: Map<string, ChannelUiMeta>;
}): ChannelInfo {
  const { channelId, labels, detailLabels, systemImages, defaultIds, rawAccounts, metaById } =
    params;
  const meta = metaById.get(channelId);

  return {
    id: channelId,
    label: labels[channelId] ?? channelId,
    detailLabel: meta?.detailLabel ?? detailLabels[channelId] ?? labels[channelId] ?? channelId,
    systemImage: meta?.systemImage ?? systemImages[channelId],
    pluginId: meta?.pluginId,
    pluginOrigin: meta?.pluginOrigin,
    pluginNpmSpec: meta?.pluginNpmSpec,
    pluginLocalPath: meta?.pluginLocalPath,
    pluginDefaultInstallChoice: meta?.pluginDefaultInstallChoice,
    pluginConfigPath: meta?.pluginConfigPath,
    accounts: Object.values(rawAccounts[channelId] ?? {}),
    defaultAccountId: defaultIds[channelId],
  };
}

/** Schema info for a channel extracted from config.schema */
export interface ChannelSchemaInfo {
  /** Config path (e.g. "channels.telegram") */
  configPath: string;
  /** JSON Schema for this channel's config section */
  schema: Record<string, unknown>;
}

export interface ProbeResult {
  status: "success" | "failure" | "timeout";
  latencyMs?: number;
  error?: string;
  probedAt: number;
}

export type ChannelHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ChannelHealth {
  status: ChannelHealthStatus;
  latencyMs?: number;
  error?: string;
  lastCheckedAt: number;
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
  pendingAccessTarget: { channelId: string; accountId?: string } | null;
  loading: boolean;
  error: string | null;

  // Throughput state
  throughput: Map<string, ThroughputData>;
  throughputWindow: ThroughputWindow;

  // Channel config state (per-channel settings from raw config)
  channelConfig: Record<string, unknown> | null;
  channelConfigSaveError: string | null;

  // Schema discovery state
  channelSchemas: Map<string, ChannelSchemaInfo>;

  // Probe state
  probeResults: Map<string, ProbeResult>;
  probing: Set<string>;

  // Real-time health state (SSE-driven)
  channelHealthMap: Map<string, ChannelHealth>;
  updateChannelHealth: (channelId: string, health: ChannelHealth) => void;

  fetchChannels: () => Promise<void>;
  selectChannel: (id: string | null) => void;
  setPendingAccessTarget: (target: { channelId: string; accountId?: string } | null) => void;
  updateChannelConfig: (channelId: string, patch: Record<string, unknown>) => Promise<boolean>;
  logoutChannel: (channelId: string) => Promise<boolean>;
  fetchThroughput: (channelId: string) => void;
  setThroughputWindow: (window: ThroughputWindow) => void;
  fetchChannelConfig: (channelId: string) => Promise<void>;
  saveChannelConfig: (channelId: string, patch: Record<string, unknown>) => Promise<boolean>;
  fetchChannelSchemas: () => Promise<void>;
  probeChannel: (channelId: string) => Promise<void>;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: new Map(),
  channelOrder: [],
  selectedId: null,
  pendingAccessTarget: null,
  loading: false,
  error: null,
  throughput: new Map(),
  throughputWindow: "1h" as ThroughputWindow,
  channelConfig: null,
  channelConfigSaveError: null,
  channelHealthMap: new Map(),
  updateChannelHealth: (channelId, health) =>
    set((state) => {
      const next = new Map(state.channelHealthMap);
      next.set(channelId, health);
      return { channelHealthMap: next };
    }),
  channelSchemas: new Map(),
  probeResults: new Map(),
  probing: new Set(),

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
      const detailLabels: Record<string, string> = data.channelDetailLabels ?? {};
      const systemImages: Record<string, string> = data.channelSystemImages ?? {};
      const metaEntries = Array.isArray(data.channelMeta)
        ? (data.channelMeta as ChannelUiMeta[])
        : [];
      const rawChannels: Record<string, unknown> = data.channels ?? {};
      const rawAccounts: Record<string, Record<string, ChannelAccount>> = data.channelAccounts ??
      {};
      const defaultIds: Record<string, string> = data.channelDefaultAccountId ?? {};
      const metaById = new Map(metaEntries.map((entry) => [entry.id, entry] as const));
      const channelMap = new Map<string, ChannelInfo>();
      const channelInfoParams = {
        labels,
        detailLabels,
        systemImages,
        defaultIds,
        rawAccounts,
        metaById,
      };

      for (const chId of order) {
        channelMap.set(chId, buildChannelInfo({ channelId: chId, ...channelInfoParams }));
      }

      // Also add any channels not in order (from rawChannels keys)
      for (const chId of Object.keys(rawChannels)) {
        if (!channelMap.has(chId)) {
          channelMap.set(chId, buildChannelInfo({ channelId: chId, ...channelInfoParams }));
          order.push(chId);
        }
      }

      set({
        channels: channelMap,
        channelOrder: order,
        probeResults: new Map(),
        channelHealthMap: new Map(),
      });
    } catch {
      set({ error: "Failed to fetch channels" });
    } finally {
      set({ loading: false });
    }
  },

  selectChannel: (selectedId) => set({ selectedId }),
  setPendingAccessTarget: (pendingAccessTarget) => set({ pendingAccessTarget }),

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
    set({ channelConfigSaveError: null });
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
      const d = await res.json().catch(() => ({ error: "Failed to save channel config" }));
      set({
        channelConfigSaveError: (d as { error?: string }).error ?? "Failed to save channel config",
      });
      return false;
    } catch (err) {
      set({
        channelConfigSaveError:
          err instanceof Error ? err.message : "Network error saving channel config",
      });
      return false;
    }
  },

  fetchChannelSchemas: async () => {
    const configStore = useConfigStore.getState();
    if (!configStore.schema) {
      await configStore.fetchSchema();
    }
    const { schema } = useConfigStore.getState();
    if (!schema) {
      return;
    }

    const schemas = new Map<string, ChannelSchemaInfo>();
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;

    // All channels (core + plugin) are under schema.properties.channels.*
    const channelsSection = properties.channels;
    if (channelsSection?.properties) {
      const channelProps = channelsSection.properties as Record<string, Record<string, unknown>>;
      for (const [chId, chSchema] of Object.entries(channelProps)) {
        if (chSchema && typeof chSchema === "object") {
          schemas.set(chId, {
            configPath: `channels.${chId}`,
            schema: chSchema,
          });
        }
      }
    }

    set({ channelSchemas: schemas });
  },

  probeChannel: async (channelId: string) => {
    set((s) => ({ probing: new Set(s.probing).add(channelId) }));

    let result: ProbeResult;
    try {
      const res = await fetch("/api/channels/probe", { method: "POST" });

      if (!res.ok) {
        const errData = await res
          .json()
          .catch(() => ({ error: `Probe failed (HTTP ${res.status})` }));
        const errMsg = (errData as { error?: string }).error ?? `Probe failed (HTTP ${res.status})`;
        result = { status: "failure", error: errMsg, probedAt: Date.now() };
      } else {
        const data = (await res.json()) as Record<string, unknown>;
        // channelAccounts[channelId] is an Array of ChannelAccountSnapshot
        const allAccounts = (data.channelAccounts ?? {}) as Record<string, ChannelAccount[]>;
        const channelAccounts = allAccounts[channelId];

        if (!channelAccounts || !Array.isArray(channelAccounts) || channelAccounts.length === 0) {
          result = { status: "failure", error: "Channel not found", probedAt: Date.now() };
        } else {
          // Aggregate probe results — field is "probe" on ChannelAccountSnapshot
          const anyOk = channelAccounts.some((a) => a.probe?.ok);
          const firstError = channelAccounts.find((a) => a.probe?.error)?.probe?.error;
          const latency =
            channelAccounts.find((a) => a.probe?.latencyMs)?.probe?.latencyMs ??
            channelAccounts.find((a) => a.probe?.elapsedMs)?.probe?.elapsedMs;
          result = {
            status: anyOk ? "success" : "failure",
            latencyMs: latency,
            error: anyOk ? undefined : firstError,
            probedAt: Date.now(),
          };
        }
      }
    } catch (err) {
      result = {
        status: "failure",
        error: err instanceof Error ? err.message : "Unexpected error during probe",
        probedAt: Date.now(),
      };
    }

    // Functional update to avoid race when multiple probes run concurrently
    set((s) => {
      const next = new Map(s.probeResults);
      next.set(channelId, result);
      const probing = new Set(s.probing);
      probing.delete(channelId);
      return { probeResults: next, probing };
    });
  },
}));
