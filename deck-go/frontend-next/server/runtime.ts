import { createGatewayClient, type GatewayClient } from "../src/types/gateway-client.generated";
import { initAlertEngine } from "./alert-engine";
// P2 subsystem bridges (stubs — Phase 1 agents will implement)
import { initApprovalBridge } from "./approval-bridge";
import type { ControlPlaneGatewaySettings, ControlPlaneDomainEvent } from "./contracts";
import { getSetting } from "./deck-settings";
import { EventBus, getEventBus } from "./event-bus";
import type { DeckEventType } from "./event-bus";
/**
 * Server Runtime Singleton — assembles all infrastructure modules.
 *
 * Uses globalThis to survive Next.js HMR reloads.
 * Lazy-initializes from environment variables on first access.
 */
import { OpenClawGatewayAdapter } from "./gateway-adapter";
import { initHealthPoller } from "./health-poller";
import { createRateLimiter } from "./rate-limit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeckRuntime = {
  adapter: OpenClawGatewayAdapter;
  gw: GatewayClient;
  eventBus: EventBus;
  rateLimiter: ReturnType<typeof createRateLimiter>;
  capabilities: DeckCapabilityState;
};

export type InitRuntimeSettings = {
  gatewayUrl?: string;
  gatewayToken?: string;
};

export type DeckCapabilitySnapshot = {
  methods: ReadonlySet<string>;
  events: ReadonlySet<string>;
  schemaVersion: string | null;
};

export type DeckCapabilityState = {
  status: "pending" | "ready" | "incompatible";
  reason: string | null;
  snapshot: DeckCapabilitySnapshot | null;
  ready: Promise<void>;
};

// ---------------------------------------------------------------------------
// globalThis key
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckRuntime__";

type GlobalStore = Record<string, DeckRuntime | undefined>;

// ---------------------------------------------------------------------------
// Settings resolution
// ---------------------------------------------------------------------------

/** Resolve gateway settings from explicit params > env > JSON settings store. */
function resolveGatewaySettings(
  settings?: InitRuntimeSettings,
): ControlPlaneGatewaySettings | null {
  const url =
    settings?.gatewayUrl ?? process.env.DECK_GATEWAY_URL ?? getSetting("gateway_url") ?? null;
  const token =
    settings?.gatewayToken ?? process.env.DECK_GATEWAY_TOKEN ?? getSetting("gateway_token") ?? null;

  if (!url || !token) {
    return null;
  }
  return { url, token };
}

function hasExternalDeckGoApiBase(): boolean {
  const raw =
    process.env.DECK_GO_API_BASE?.trim() ?? process.env.NEXT_PUBLIC_DECK_GO_API_BASE?.trim() ?? "";
  return raw !== "";
}

// ---------------------------------------------------------------------------
// Domain event bridge
// ---------------------------------------------------------------------------

/** Valid DeckEventType values for type-safe broadcasting. */
const VALID_DECK_EVENTS = new Set<DeckEventType>([
  "runtime.status",
  "gateway.event",
  "chat",
  "agent",
  "agent.updated",
  "commands.changed",
  "gateway.health",
  "notification.toast",
  "log.entry",
  "activity.event",
  // P2 additions
  "approval.pending",
  "approval.resolved",
  "budget.warn",
  "budget.over",
  "alert.fired",
  "webhook.delivery",
  "cron.run.complete",
  "canvas",
  // Device pairing events
  "device.pair.requested",
  "device.pair.resolved",
  // Phase 2 real-time status events
  "agent.status.changed",
  "channel.health.changed",
]);

const REQUIRED_GATEWAY_METHODS = [
  "gateway.describe",
  "sessions.create",
  "sessions.send",
  "sessions.abort",
  "sessions.subscribe",
  "sessions.messages.subscribe",
  "config.schema.lookup",
] as const;

/** Events that should be bridged to the activity feed outbox. */
const ACTIVITY_BRIDGE_EVENTS = new Set<string>(["chat", "agent", "agent.updated"]);
const SESSION_EVENT_INTAKE_MAP = {
  "sessions.changed": "session-state",
  "session.message": "session-msg",
  "session.tool": "session-tool",
} as const satisfies Record<string, DeckEventType>;

/**
 * Map ControlPlaneDomainEvent to DeckEventType and broadcast.
 *
 * Gateway WS events arrive as `{ type: "gateway.event", event: "chat"|"agent"|..., payload }`.
 * We extract the inner event name so SSE clients can listen on `"chat"` / `"agent"` directly.
 *
 * Agent/chat events are also persisted to the outbox as activity events and
 * broadcast on the "activity.event" channel for the Activity Feed panel.
 */
function bridgeDomainEvent(event: ControlPlaneDomainEvent, eventBus: EventBus): void {
  if (event.type === "gateway.event" && "event" in event) {
    const normalizedEventType =
      SESSION_EVENT_INTAKE_MAP[event.event as keyof typeof SESSION_EVENT_INTAKE_MAP];
    if (normalizedEventType) {
      eventBus.broadcast(normalizedEventType, event.payload);
    }
    const innerEvent = event.event as DeckEventType;
    if (VALID_DECK_EVENTS.has(innerEvent)) {
      // Broadcast the payload under the specific event type (e.g., "chat", "agent")
      eventBus.broadcast(innerEvent, event.payload);

      // Bridge agent/chat events into activity outbox.
      if (ACTIVITY_BRIDGE_EVENTS.has(innerEvent)) {
        bridgeToActivity(innerEvent, event.payload, eventBus);
      }
      return;
    }
    // Unknown inner event — broadcast as generic gateway.event
    eventBus.broadcast("gateway.event", event);
    return;
  }
  // runtime.status events
  if (VALID_DECK_EVENTS.has(event.type as DeckEventType)) {
    eventBus.broadcast(event.type as DeckEventType, event);
    return;
  }
  eventBus.broadcast("gateway.event", event);
}

/** Derive an activity event from a Gateway domain event and persist + broadcast it. */
function bridgeToActivity(eventType: string, payload: unknown, eventBus: EventBus): void {
  const p = (payload ?? {}) as Record<string, unknown>;
  const now = Date.now();
  const id = `act-${now}-${Math.random().toString(36).slice(2, 8)}`;

  let type: string;
  let description: string;
  let agentId: string | undefined;
  let agentName: string | undefined;
  let details: string | undefined;

  if (eventType === "chat") {
    type = "chat";
    const state = (p.state as string) ?? "";
    const sessionKey = (p.sessionKey as string) ?? "";
    description =
      state === "final"
        ? `Chat message completed (${sessionKey})`
        : `Chat ${state} (${sessionKey})`;
    details = typeof p.errorMessage === "string" ? p.errorMessage : undefined;
  } else if (eventType === "agent" || eventType === "agent.updated") {
    type = "agent";
    agentId = p.agentId as string | undefined;
    agentName = p.name as string | undefined;
    const status = p.status as string | undefined;
    description = status
      ? `Agent ${agentName ?? agentId ?? "unknown"}: ${status}`
      : `Agent ${agentName ?? agentId ?? "unknown"} updated`;
  } else {
    type = "system";
    description = `Gateway event: ${eventType}`;
  }

  const activityPayload = {
    id,
    timestamp: now,
    type,
    agentId,
    agentName,
    description,
    details,
  };

  // Persist to outbox.
  // Broadcast via EventBus so SSE clients receive it in real-time and the
  // configured replay store can assign the canonical SSE event id.
  eventBus.broadcast("activity.event", activityPayload);
}

// toReplayEvent removed — EventBus memory buffer replaces outbox persistence (S7).

function createPendingCapabilityState(): {
  state: DeckCapabilityState;
  beginBootstrap: () => void;
  markReady: (snapshot: DeckCapabilitySnapshot) => void;
  markIncompatible: (reason: string) => void;
  markTransientFailure: (reason: string) => void;
} {
  let resolveReady!: () => void;
  let readySettled = false;
  const state: DeckCapabilityState = {
    status: "pending",
    reason: null,
    snapshot: null,
    ready: Promise.resolve(),
  };
  const resetReady = () => {
    readySettled = false;
    state.ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
  };
  resetReady();
  return {
    state,
    beginBootstrap() {
      if (!readySettled && state.status === "pending" && !state.snapshot && !state.reason) {
        return;
      }
      state.status = "pending";
      state.reason = null;
      state.snapshot = null;
      resetReady();
    },
    markReady(snapshot) {
      state.status = "ready";
      state.snapshot = snapshot;
      state.reason = null;
      readySettled = true;
      resolveReady();
    },
    markIncompatible(reason) {
      state.status = "incompatible";
      state.reason = reason;
      state.snapshot = null;
      readySettled = true;
      resolveReady();
    },
    markTransientFailure(reason) {
      state.status = "pending";
      state.reason = reason;
      state.snapshot = null;
      readySettled = true;
      resolveReady();
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function buildCapabilitySnapshot(payload: unknown):
  | {
      ok: true;
      snapshot: DeckCapabilitySnapshot;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!isRecord(payload)) {
    return { ok: false, reason: "gateway.describe returned a non-object payload" };
  }
  const methods = payload.methods;
  const events = payload.events;
  if (!isRecord(methods) || !isRecord(events)) {
    return { ok: false, reason: "gateway.describe payload missing methods/events objects" };
  }
  const methodNames = new Set(Object.keys(methods));
  const missing = REQUIRED_GATEWAY_METHODS.filter((method) => !methodNames.has(method));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Gateway missing required capability: ${missing.join(", ")}`,
    };
  }
  return {
    ok: true,
    snapshot: {
      methods: methodNames,
      events: new Set(Object.keys(events)),
      schemaVersion: typeof payload.schemaVersion === "string" ? payload.schemaVersion : null,
    },
  };
}

function classifyCapabilityBootstrapError(error: unknown): {
  incompatible: boolean;
  reason: string;
} {
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "INVALID_REQUEST" &&
    error.message.includes("unknown method: gateway.describe")
  ) {
    return {
      incompatible: true,
      reason: "Gateway missing required capability: gateway.describe",
    };
  }
  return {
    incompatible: false,
    reason: error instanceof Error ? error.message : String(error),
  };
}

async function bootstrapGatewayCapabilities(runtime: DeckRuntime): Promise<
  | {
      ok: true;
      snapshot: DeckCapabilitySnapshot;
    }
  | {
      ok: false;
      incompatible: boolean;
      reason: string;
    }
> {
  try {
    const payload = await runtime.adapter.request("gateway.describe", {
      filter: "all",
      includeSchemas: false,
    });
    const normalized = buildCapabilitySnapshot(payload);
    if (!normalized.ok) {
      return { ok: false, incompatible: true, reason: normalized.reason };
    }
    return { ok: true, snapshot: normalized.snapshot };
  } catch (err) {
    const classified = classifyCapabilityBootstrapError(err);
    return {
      ok: false,
      incompatible: classified.incompatible,
      reason: classified.reason,
    };
  }
}

// ---------------------------------------------------------------------------
// initRuntime
// ---------------------------------------------------------------------------

/**
 * Initialize the runtime singleton with all infrastructure components.
 * Returns `null` when gateway settings cannot be resolved (onboarding needed).
 */
export function initRuntime(settings?: InitRuntimeSettings): DeckRuntime | null {
  const g = globalThis as unknown as GlobalStore;
  if (g[GLOBAL_KEY]) {
    return g[GLOBAL_KEY];
  }

  const eventBus = getEventBus();

  const gwSettings = resolveGatewaySettings(settings);
  if (!gwSettings) {
    return null;
  }

  const rateLimiter = createRateLimiter({ maxRequests: 300 });
  const capabilityState = createPendingCapabilityState();
  let capabilityBootstrapInFlight: Promise<void> | null = null;
  let runtime!: DeckRuntime;

  const adapter = new OpenClawGatewayAdapter({
    loadSettings: () => {
      // Re-resolve on every reconnect so updated settings take effect.
      const latest = resolveGatewaySettings(settings);
      return latest ?? gwSettings;
    },
    onDomainEvent: (event) => {
      bridgeDomainEvent(event, eventBus);
      if (event.type === "runtime.status" && event.status === "connected") {
        triggerCapabilityBootstrap();
      }
    },
  });

  const gw = createGatewayClient((method, params, options) =>
    adapter.request(method, params, options),
  );

  runtime = {
    adapter,
    gw,
    eventBus,
    rateLimiter,
    capabilities: capabilityState.state,
  };
  g[GLOBAL_KEY] = runtime;
  const healthPoller = initHealthPoller(gw, eventBus, undefined, false, (method, params) =>
    adapter.request(method, params),
  );

  function triggerCapabilityBootstrap(): void {
    if (capabilityBootstrapInFlight) {
      return;
    }
    capabilityState.beginBootstrap();
    capabilityBootstrapInFlight = bootstrapGatewayCapabilities(runtime)
      .then((result) => {
        if (result.ok) {
          capabilityState.markReady(result.snapshot);
          // Avoid extra startup RPC traffic until the next scheduled interval;
          // the underlying panels already fetch their own initial snapshots.
          healthPoller.start(false);
          return;
        }
        if (result.incompatible) {
          capabilityState.markIncompatible(result.reason);
          return;
        }
        capabilityState.markTransientFailure(result.reason);
      })
      .catch((err) => {
        capabilityState.markTransientFailure(err instanceof Error ? err.message : String(err));
        console.error("[DeckRuntime] capability bootstrap failed:", err);
      })
      .finally(() => {
        capabilityBootstrapInFlight = null;
      });
  }

  // Start adapter (non-blocking — reconnection handled internally) and bootstrap capabilities.
  void adapter
    .start()
    .then(() => {
      triggerCapabilityBootstrap();
    })
    .catch((err) => {
      capabilityState.markTransientFailure(err instanceof Error ? err.message : String(err));
      console.error("[DeckRuntime] adapter start failed:", err);
    });

  // Initialize P2 subsystem bridges — store cleanup refs on globalThis for HMR safety (F12)
  const gCleanup = globalThis as Record<string, unknown>;
  gCleanup.__deckCleanupApproval = initApprovalBridge(runtime);
  gCleanup.__deckCleanupAlerts = initAlertEngine(runtime);
  // Phase 2: start health polling only after a successful capability bootstrap.
  gCleanup.__deckCleanupHealthPoller = () => healthPoller.stop();

  // F10: Schedule webhook retry processor every 60s
  const retryTimer = setInterval(async () => {
    try {
      const { processWebhookRetries } = await import("../src/lib/webhooks");
      processWebhookRetries().catch((err: unknown) =>
        console.error("[DeckRuntime] webhook retry error:", err),
      );
    } catch {
      // Module not available — ignore
    }
  }, 60_000);
  gCleanup.__deckRetryTimer = retryTimer;

  return runtime;
}

// ---------------------------------------------------------------------------
// getRuntime
// ---------------------------------------------------------------------------

/**
 * Return the runtime singleton.
 * If not yet initialized, attempts lazy init from env/DB.
 * Returns `null` when gateway settings are unavailable (onboarding needed).
 */
export function getRuntime(): DeckRuntime | null {
  const g = globalThis as unknown as GlobalStore;
  if (g[GLOBAL_KEY]) {
    return g[GLOBAL_KEY];
  }

  if (hasExternalDeckGoApiBase()) {
    return null;
  }

  // Attempt lazy initialization from environment / DB.
  return initRuntime();
}

// ---------------------------------------------------------------------------
// shutdownRuntime
// ---------------------------------------------------------------------------

/** Gracefully shut down the runtime: stop adapter, dispose rate limiter, call cleanups. */
export async function shutdownRuntime(): Promise<void> {
  const g = globalThis as unknown as GlobalStore;
  const runtime = g[GLOBAL_KEY];
  if (!runtime) {
    return;
  }

  g[GLOBAL_KEY] = undefined;

  // F12: Call cleanup functions for P2 subsystem bridges
  const gCleanup = globalThis as Record<string, unknown>;
  (gCleanup.__deckCleanupApproval as (() => void) | undefined)?.();
  (gCleanup.__deckCleanupAlerts as (() => void) | undefined)?.();
  (gCleanup.__deckCleanupHealthPoller as (() => void) | undefined)?.();
  clearInterval(gCleanup.__deckRetryTimer as ReturnType<typeof setInterval>);
  gCleanup.__deckCleanupApproval = undefined;
  gCleanup.__deckCleanupAlerts = undefined;
  gCleanup.__deckCleanupHealthPoller = undefined;
  gCleanup.__deckRetryTimer = undefined;
  await runtime.adapter.stop();
  runtime.rateLimiter.dispose();
}
