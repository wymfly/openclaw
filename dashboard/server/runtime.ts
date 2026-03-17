import { initAlertEngine } from "./alert-engine.js";
// P2 subsystem bridges (stubs — Phase 1 agents will implement)
import { initApprovalBridge } from "./approval-bridge.js";
import type { ControlPlaneGatewaySettings, ControlPlaneDomainEvent } from "./contracts";
import { getDb, type Database } from "./db";
import { EventBus, getEventBus } from "./event-bus";
import type { DeckEventType } from "./event-bus";
/**
 * Server Runtime Singleton — assembles all infrastructure modules.
 *
 * Uses globalThis to survive Next.js HMR reloads.
 * Lazy-initializes from environment variables on first access.
 */
import { OpenClawGatewayAdapter } from "./gateway-adapter";
import { ProjectionStore } from "./projection-store";
import { createRateLimiter } from "./rate-limit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeckRuntime = {
  adapter: OpenClawGatewayAdapter;
  eventBus: EventBus;
  db: Database;
  store: ProjectionStore;
  rateLimiter: ReturnType<typeof createRateLimiter>;
};

export type InitRuntimeSettings = {
  gatewayUrl?: string;
  gatewayToken?: string;
};

// ---------------------------------------------------------------------------
// globalThis key
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckRuntime__";

type GlobalStore = Record<string, DeckRuntime | undefined>;

// ---------------------------------------------------------------------------
// Settings resolution
// ---------------------------------------------------------------------------

/** Resolve gateway settings from explicit params > env > DB settings table. */
function resolveGatewaySettings(
  settings?: InitRuntimeSettings,
  store?: ProjectionStore,
): ControlPlaneGatewaySettings | null {
  const url =
    settings?.gatewayUrl ??
    process.env.DECK_GATEWAY_URL ??
    store?.getSetting("gateway_url") ??
    null;
  const token =
    settings?.gatewayToken ??
    process.env.DECK_GATEWAY_TOKEN ??
    store?.getSetting("gateway_token") ??
    null;

  if (!url || !token) {
    return null;
  }
  return { url, token };
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
]);

/** Events that should be bridged to the activity feed outbox. */
const ACTIVITY_BRIDGE_EVENTS = new Set<string>(["chat", "agent", "agent.updated"]);

/**
 * Map ControlPlaneDomainEvent to DeckEventType and broadcast.
 *
 * Gateway WS events arrive as `{ type: "gateway.event", event: "chat"|"agent"|..., payload }`.
 * We extract the inner event name so SSE clients can listen on `"chat"` / `"agent"` directly.
 *
 * Agent/chat events are also persisted to the outbox as activity events and
 * broadcast on the "activity.event" channel for the Activity Feed panel.
 */
function bridgeDomainEvent(
  event: ControlPlaneDomainEvent,
  eventBus: EventBus,
  store?: ProjectionStore,
): void {
  if (event.type === "gateway.event" && "event" in event) {
    const innerEvent = event.event as DeckEventType;
    if (VALID_DECK_EVENTS.has(innerEvent)) {
      // Broadcast the payload under the specific event type (e.g., "chat", "agent")
      eventBus.broadcast(innerEvent, event.payload);

      // Bridge agent/chat events into activity outbox.
      if (ACTIVITY_BRIDGE_EVENTS.has(innerEvent) && store) {
        bridgeToActivity(innerEvent, event.payload, store, eventBus);
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
function bridgeToActivity(
  eventType: string,
  payload: unknown,
  store: ProjectionStore,
  eventBus: EventBus,
): void {
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
  try {
    store.appendEvent("activity.event", activityPayload);
  } catch {
    // Non-critical — log and continue.
    console.error("[DeckRuntime] failed to persist activity event");
  }

  // Broadcast via EventBus so SSE clients receive it in real-time.
  eventBus.broadcast("activity.event", activityPayload);
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

  const db = getDb();
  const store = new ProjectionStore(db);
  const eventBus = getEventBus();

  const gwSettings = resolveGatewaySettings(settings, store);
  if (!gwSettings) {
    return null;
  }

  const rateLimiter = createRateLimiter();

  const adapter = new OpenClawGatewayAdapter({
    loadSettings: () => {
      // Re-resolve on every reconnect so updated settings take effect.
      const latest = resolveGatewaySettings(settings, store);
      return latest ?? gwSettings;
    },
    onDomainEvent: (event) => bridgeDomainEvent(event, eventBus, store),
  });

  // Start the adapter (non-blocking — reconnection is handled internally).
  void adapter.start().catch((err) => {
    console.error("[DeckRuntime] adapter start failed:", err);
  });

  const runtime: DeckRuntime = { adapter, eventBus, db, store, rateLimiter };
  g[GLOBAL_KEY] = runtime;

  // Initialize P2 subsystem bridges — store cleanup refs on globalThis for HMR safety (F12)
  const gCleanup = globalThis as Record<string, unknown>;
  gCleanup.__deckCleanupApproval = initApprovalBridge(runtime);
  gCleanup.__deckCleanupAlerts = initAlertEngine(runtime);

  // F10: Schedule webhook retry processor every 60s
  const retryTimer = setInterval(async () => {
    try {
      const { processWebhookRetries } = await import("../src/lib/webhooks.js");
      processWebhookRetries(runtime.db).catch((err: unknown) =>
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
  clearInterval(gCleanup.__deckRetryTimer as ReturnType<typeof setInterval>);
  gCleanup.__deckCleanupApproval = undefined;
  gCleanup.__deckCleanupAlerts = undefined;
  gCleanup.__deckRetryTimer = undefined;

  await runtime.adapter.stop();
  runtime.rateLimiter.dispose();
}
