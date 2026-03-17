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
]);

/**
 * Map ControlPlaneDomainEvent to DeckEventType and broadcast.
 *
 * Gateway WS events arrive as `{ type: "gateway.event", event: "chat"|"agent"|..., payload }`.
 * We extract the inner event name so SSE clients can listen on `"chat"` / `"agent"` directly.
 */
function bridgeDomainEvent(event: ControlPlaneDomainEvent, eventBus: EventBus): void {
  if (event.type === "gateway.event" && "event" in event) {
    const innerEvent = event.event as DeckEventType;
    if (VALID_DECK_EVENTS.has(innerEvent)) {
      // Broadcast the payload under the specific event type (e.g., "chat", "agent")
      eventBus.broadcast(innerEvent, event.payload);
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
    onDomainEvent: (event) => bridgeDomainEvent(event, eventBus),
  });

  // Start the adapter (non-blocking — reconnection is handled internally).
  void adapter.start().catch((err) => {
    console.error("[DeckRuntime] adapter start failed:", err);
  });

  const runtime: DeckRuntime = { adapter, eventBus, db, store, rateLimiter };
  g[GLOBAL_KEY] = runtime;
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

/** Gracefully shut down the runtime: stop adapter, dispose rate limiter. */
export async function shutdownRuntime(): Promise<void> {
  const g = globalThis as unknown as GlobalStore;
  const runtime = g[GLOBAL_KEY];
  if (!runtime) {
    return;
  }

  g[GLOBAL_KEY] = undefined;

  await runtime.adapter.stop();
  runtime.rateLimiter.dispose();
}
