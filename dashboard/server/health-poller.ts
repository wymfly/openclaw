/**
 * Health Poller — periodic polling that derives `agent.status.changed` and
 * `channel.health.changed` SSE events from Gateway health/status data.
 *
 * This is a server-side polling-to-SSE bridge. If Gateway later adds native
 * events for these, the poller can be replaced with bridgeDomainEvent() mappings.
 */
import type { GatewayClient } from "../src/types/gateway-client.generated";
import type { EventBus } from "./event-bus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChannelSnapshot = {
  channelId: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs?: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Health Poller
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 60_000;

export function initHealthPoller(
  gw: GatewayClient,
  eventBus: EventBus,
  intervalMs = DEFAULT_INTERVAL_MS,
): () => void {
  let prevAgents = new Map<string, string>();
  let prevChannels = new Map<string, ChannelSnapshot>();
  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll(): Promise<void> {
    try {
      await pollAgentStatus();
    } catch {
      // Gateway unreachable — skip this cycle.
    }
    try {
      await pollChannelHealth();
    } catch {
      // Gateway unreachable — skip this cycle.
    }
  }

  async function pollAgentStatus(): Promise<void> {
    const result = await gw.health({});
    const raw = result as unknown as Record<string, unknown>;
    const agents = Array.isArray(raw.agents) ? (raw.agents as Record<string, unknown>[]) : [];

    const current = new Map<string, string>();
    for (const a of agents) {
      const agentId = typeof a.agentId === "string" ? a.agentId : String(a.name ?? "main");
      const sessions = a.sessions as { count?: number } | undefined;
      const status = (sessions?.count ?? 0) > 0 ? "busy" : "idle";
      current.set(agentId, status);
    }

    // Detect changes
    for (const [agentId, status] of current) {
      const prev = prevAgents.get(agentId);
      if (prev !== status) {
        eventBus.broadcast("agent.status.changed", {
          agentId,
          status,
          previousStatus: prev ?? "unknown",
          timestamp: Date.now(),
        });
      }
    }
    // Detect agents that disappeared (went offline)
    for (const [agentId] of prevAgents) {
      if (!current.has(agentId)) {
        eventBus.broadcast("agent.status.changed", {
          agentId,
          status: "offline",
          previousStatus: prevAgents.get(agentId) ?? "unknown",
          timestamp: Date.now(),
        });
      }
    }
    prevAgents = current;
  }

  async function pollChannelHealth(): Promise<void> {
    const result = await gw.channels.status({});
    const raw = result as unknown as Record<string, unknown>;
    const channels = (raw.channels ?? raw) as Record<string, unknown>;

    const current = new Map<string, ChannelSnapshot>();

    if (typeof channels === "object" && channels !== null) {
      for (const [channelId, info] of Object.entries(channels)) {
        const snapshot = deriveChannelHealth(channelId, info);
        current.set(channelId, snapshot);
      }
    }

    // Detect changes
    for (const [channelId, snap] of current) {
      const prev = prevChannels.get(channelId);
      if (!prev || prev.status !== snap.status || prev.error !== snap.error) {
        eventBus.broadcast("channel.health.changed", {
          ...snap,
          timestamp: Date.now(),
        });
      }
    }
    // Detect channels that disappeared
    for (const [channelId] of prevChannels) {
      if (!current.has(channelId)) {
        eventBus.broadcast("channel.health.changed", {
          channelId,
          status: "down",
          timestamp: Date.now(),
        });
      }
    }
    prevChannels = current;
  }

  // Start polling
  void poll();
  timer = setInterval(() => void poll(), intervalMs);

  // Return cleanup function
  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveChannelHealth(channelId: string, info: unknown): ChannelSnapshot {
  if (typeof info === "string") {
    return {
      channelId,
      status: info === "connected" || info === "running" ? "healthy" : "down",
    };
  }
  if (typeof info === "object" && info !== null) {
    const obj = info as Record<string, unknown>;
    // Channel accounts array or single status object
    if (Array.isArray(obj.accounts)) {
      const accounts = obj.accounts as Record<string, unknown>[];
      const hasError = accounts.some((a) => a.lastError);
      const hasConnected = accounts.some((a) => a.connected || a.linked);
      if (hasError && hasConnected) {
        return { channelId, status: "degraded", error: "Some accounts have errors" };
      }
      if (hasError) {
        return {
          channelId,
          status: "down",
          error: String((accounts.find((a) => a.lastError) as Record<string, unknown>)?.lastError),
        };
      }
      if (hasConnected) {
        return { channelId, status: "healthy" };
      }
      return { channelId, status: "unknown" };
    }
    // Direct status fields
    if (obj.lastError) {
      return { channelId, status: "down", error: String(obj.lastError) };
    }
    if (obj.configured || obj.connected) {
      return { channelId, status: "healthy" };
    }
  }
  return { channelId, status: "unknown" };
}
