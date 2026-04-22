/**
 * EventBus — typed pub/sub with auto-incrementing IDs and replay buffer.
 *
 * Uses globalThis singleton to survive Next.js HMR reloads.
 *
 * Event type contract aligned with Gateway:
 *   - Gateway broadcasts `chat` events with a `state` field: delta | final | error | aborted
 *   - Gateway broadcasts `agent` events for lifecycle/tool/assistant streams
 *   - Deck-internal events: runtime.status, agent.updated, notification.toast, gateway.health
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeckEventType =
  | "runtime.status"
  | "gateway.event"
  | "chat"
  | "agent"
  | "agent.updated"
  | "commands.changed"
  | "gateway.health"
  | "notification.toast"
  // P1 additions
  | "log.entry"
  | "activity.event"
  // P2 additions
  | "approval.pending"
  | "approval.resolved"
  | "budget.warn"
  | "budget.over"
  | "alert.fired"
  | "webhook.delivery"
  | "cron.run.complete"
  | "canvas"
  // Device pairing events
  | "device.pair.requested"
  | "device.pair.resolved"
  // Phase 2 real-time status events (server-side health poller derives these)
  | "agent.status.changed"
  | "channel.health.changed"
  // Upstream session events (Layer 2 — bypass RunEventPipeline)
  | "session-state"
  | "session-msg"
  | "session-tool";

export type ServerEvent = {
  id: number;
  type: DeckEventType;
  data: unknown;
  timestamp: number;
};

export type ServerEventSubscriber = (event: ServerEvent) => void;

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

const REPLAY_BUFFER_SIZE = 2000;

export class EventBus {
  private nextId = 1;
  private subscribers = new Set<ServerEventSubscriber>();
  private buffer: ServerEvent[] = [];

  /** Broadcast an event to all subscribers. Each subscriber is error-isolated. */
  broadcast(type: DeckEventType, data: unknown): ServerEvent {
    const id = this.nextId++;
    const event: ServerEvent = {
      id,
      type,
      data,
      timestamp: Date.now(),
    };

    // Maintain fixed-size replay buffer (ring-style trim).
    this.buffer.push(event);
    if (this.buffer.length > REPLAY_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-REPLAY_BUFFER_SIZE);
    }

    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (err) {
        console.error("[EventBus] subscriber threw:", err);
      }
    }

    return event;
  }

  subscribe(callback: ServerEventSubscriber): void {
    this.subscribers.add(callback);
  }

  unsubscribe(callback: ServerEventSubscriber): void {
    this.subscribers.delete(callback);
  }

  /**
   * Return events with id > lastId from the replay buffer.
   * Returns { events, gapDetected } — gap means lastId fell out of buffer.
   */
  getEventsSince(lastId: number): { events: ServerEvent[]; gapDetected: boolean } {
    if (this.buffer.length === 0) {
      return { events: [], gapDetected: false };
    }
    // lastId 0 means "give me everything in the buffer" (no gap possible).
    if (lastId === 0) {
      return { events: [...this.buffer], gapDetected: false };
    }
    const oldest = this.buffer[0];
    // If requested ID is older than buffer start, a gap exists.
    const gapDetected = lastId < oldest.id;
    const events = this.buffer.filter((e) => e.id > lastId);
    return { events, gapDetected };
  }

  /** Current subscriber count (useful for tests / diagnostics). */
  get subscriberCount(): number {
    return this.subscribers.size;
  }
}

// ---------------------------------------------------------------------------
// globalThis singleton (HMR-safe)
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckEventBus__";

export function getEventBus(): EventBus {
  const g = globalThis as unknown as Record<string, EventBus | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new EventBus();
  }
  return g[GLOBAL_KEY];
}
