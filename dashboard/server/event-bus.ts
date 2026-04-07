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

export type ReplayStore = {
  appendEvent: (type: DeckEventType, data: unknown) => number;
  getEventsSince: (lastId: number) => ServerEvent[];
};

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

const REPLAY_BUFFER_SIZE = 100;

export class EventBus {
  private nextId = 1;
  private subscribers = new Set<ServerEventSubscriber>();
  private buffer: ServerEvent[] = [];
  private replayStore: ReplayStore | null = null;

  /** Broadcast an event to all subscribers. Each subscriber is error-isolated. */
  broadcast(type: DeckEventType, data: unknown): ServerEvent {
    let id: number;
    if (this.replayStore) {
      try {
        id = this.replayStore.appendEvent(type, data);
      } catch (err) {
        console.error("[EventBus] replay append failed:", err);
        id = this.nextId;
      }
    } else {
      id = this.nextId;
    }
    const event: ServerEvent = {
      id,
      type,
      data,
      timestamp: Date.now(),
    };
    this.nextId = Math.max(this.nextId, id + 1);

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

  /** Return events with id > lastId from the replay buffer. */
  getEventsSince(lastId: number): ServerEvent[] {
    if (this.replayStore) {
      try {
        return this.replayStore.getEventsSince(lastId);
      } catch (err) {
        console.error("[EventBus] replay read failed:", err);
      }
    }
    return this.buffer.filter((e) => e.id > lastId);
  }

  setReplayStore(store: ReplayStore | null): void {
    this.replayStore = store;
  }

  hasReplayStore(): boolean {
    return this.replayStore !== null;
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
