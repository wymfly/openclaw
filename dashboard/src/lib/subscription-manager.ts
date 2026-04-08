/**
 * Unified subscription orchestration layer for Deck ↔ Gateway real-time events.
 *
 * Manages subscription lifecycle (state machine), reference counting (dedup),
 * error classification (transient/fatal), and reconnect backoff.
 *
 * This module is pure logic — it does not own the WebSocket connection.
 * The gateway-adapter injects a `sendRpc` callback to issue subscribe/unsubscribe RPCs.
 *
 * State machine:
 *   IDLE ──connect()──→ CONNECTING ──handleOpen()──→ ACTIVE
 *                            │                         │
 *                        handleError()           handleClose()/handleError()
 *                            ↓                         ↓
 *                          ERROR ←──────────── RECONNECTING
 *                            │                         │
 *                   (fatal → notify+fallback)   (transient → exponential backoff)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubscriptionState = "IDLE" | "CONNECTING" | "ACTIVE" | "RECONNECTING" | "ERROR";
export type ErrorSeverity = "transient" | "fatal";

export interface SubscriptionError {
  severity: ErrorSeverity;
  code: string;
  message: string;
  originalError?: unknown;
}

export interface SubscriptionManagerOptions {
  /** Send an RPC call to the Gateway. Injected by gateway-adapter. */
  sendRpc: (method: string, params: Record<string, unknown>) => Promise<unknown>;
  /** Called when the state machine transitions. */
  onStateChange?: (state: SubscriptionState, prev: SubscriptionState) => void;
  /** Called when a fatal error occurs (should trigger UI notification + SSE fallback). */
  onFatal?: (error: SubscriptionError) => void;
  /** Called to schedule a reconnect attempt (adapter calls connect again). */
  onReconnectScheduled?: (delayMs: number) => void;
  /** Base reconnect delay in ms. Default 1000. */
  reconnectBaseMs?: number;
  /** Max reconnect delay in ms. Default 30000. */
  reconnectMaxMs?: number;
  /** Jitter factor (0-1). Default 0.2 (±20%). */
  reconnectJitter?: number;
  /** Max consecutive reconnect failures before escalating to fatal. Default 5. */
  maxConsecutiveFailures?: number;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const FATAL_RPC_CODES = new Set(["METHOD_NOT_FOUND", "UNAUTHORIZED", "NOT_PAIRED"]);

/**
 * Classify an error as transient (auto-reconnect) or fatal (notify user).
 *
 * Mapping table (from plan):
 *   - WS close 1006 (abnormal)          → transient
 *   - WS close 1000/1001 (normal)       → transient
 *   - RPC METHOD_NOT_FOUND              → fatal
 *   - RPC UNAUTHORIZED / NOT_PAIRED     → fatal
 *   - RPC INTERNAL_ERROR                → transient (escalates after max failures)
 *   - Network offline                    → transient (wait for online)
 *   - 5 consecutive reconnect failures  → fatal
 */
export function classifyError(error: unknown): SubscriptionError {
  // WebSocket close codes
  if (isWsCloseEvent(error)) {
    const code = (error as { code: number }).code;
    return {
      severity: "transient",
      code: `WS_CLOSE_${code}`,
      message: `WebSocket closed with code ${code}`,
      originalError: error,
    };
  }

  // Gateway RPC errors (ControlPlaneGatewayError shape)
  if (isGatewayError(error)) {
    const rpcCode = (error as { code: string }).code;
    if (FATAL_RPC_CODES.has(rpcCode)) {
      return {
        severity: "fatal",
        code: rpcCode,
        message: (error as Error).message,
        originalError: error,
      };
    }
    // INTERNAL_ERROR and others — transient (may escalate via consecutive failure count)
    return {
      severity: "transient",
      code: rpcCode,
      message: (error as Error).message,
      originalError: error,
    };
  }

  // Network offline
  if (error instanceof Error && error.message.includes("GATEWAY_UNAVAILABLE")) {
    return {
      severity: "transient",
      code: "GATEWAY_UNAVAILABLE",
      message: "Gateway is unavailable",
      originalError: error,
    };
  }

  // Generic unknown error — treat as transient
  return {
    severity: "transient",
    code: "UNKNOWN",
    message: error instanceof Error ? error.message : String(error),
    originalError: error,
  };
}

function isWsCloseEvent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "number" &&
    "type" in error &&
    (error as { type: string }).type === "close"
  );
}

function isGatewayError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

// ---------------------------------------------------------------------------
// Reconnect backoff
// ---------------------------------------------------------------------------

/**
 * Calculate reconnect delay with exponential backoff + jitter.
 *
 * delay = min(base * 2^attempt, max) * (1 + jitter * random(-1, 1))
 */
export function computeReconnectDelay(
  attempt: number,
  baseMs: number,
  maxMs: number,
  jitter: number,
): number {
  const exponential = Math.min(baseMs * 2 ** attempt, maxMs);
  const jitterFactor = 1 + jitter * (Math.random() * 2 - 1);
  return Math.round(exponential * jitterFactor);
}

// ---------------------------------------------------------------------------
// SubscriptionManager
// ---------------------------------------------------------------------------

export class SubscriptionManager {
  private _state: SubscriptionState = "IDLE";
  private readonly opts: Required<
    Pick<
      SubscriptionManagerOptions,
      "reconnectBaseMs" | "reconnectMaxMs" | "reconnectJitter" | "maxConsecutiveFailures"
    >
  > &
    SubscriptionManagerOptions;

  /** Per-session message subscription reference counts. */
  private readonly sessionRefs = new Map<string, number>();
  /** Whether the global sessions.subscribe is active. */
  private lifecycleSubscribed = false;
  /** Consecutive reconnect failure counter. */
  private consecutiveFailures = 0;

  constructor(options: SubscriptionManagerOptions) {
    this.opts = {
      reconnectBaseMs: 1_000,
      reconnectMaxMs: 30_000,
      reconnectJitter: 0.2,
      maxConsecutiveFailures: 5,
      ...options,
    };
  }

  // -- State machine --------------------------------------------------------

  get state(): SubscriptionState {
    return this._state;
  }

  private transition(next: SubscriptionState): void {
    if (this._state === next) {
      return;
    }
    const prev = this._state;
    this._state = next;
    this.opts.onStateChange?.(next, prev);
  }

  /**
   * Signal that a connection attempt is starting.
   * Called by gateway-adapter when it opens a new WebSocket.
   */
  connect(): void {
    if (this._state === "ACTIVE") {
      return;
    }
    this.transition("CONNECTING");
  }

  /**
   * Signal that the connection is fully established.
   * Called by gateway-adapter after the HELLO handshake succeeds.
   */
  handleOpen(): void {
    this.consecutiveFailures = 0;
    this.transition("ACTIVE");
  }

  /**
   * Signal that the connection closed.
   * Classifies the close event and transitions to RECONNECTING or ERROR.
   */
  handleClose(code: number, _reason: string): void {
    if (this._state === "IDLE") {
      return;
    }

    const error = classifyError({ type: "close", code });
    this.handleDisconnect(error);
  }

  /**
   * Signal that an error occurred on the connection or an RPC call.
   */
  handleError(error: unknown): void {
    if (this._state === "IDLE") {
      return;
    }

    const classified = classifyError(error);
    this.handleDisconnect(classified);
  }

  private handleDisconnect(error: SubscriptionError): void {
    if (error.severity === "fatal") {
      this.transition("ERROR");
      this.opts.onFatal?.(error);
      return;
    }

    // Transient error — check consecutive failure escalation
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.opts.maxConsecutiveFailures) {
      const escalated: SubscriptionError = {
        severity: "fatal",
        code: "MAX_RECONNECT_FAILURES",
        message: `${this.consecutiveFailures} consecutive reconnect failures`,
        originalError: error.originalError,
      };
      this.transition("ERROR");
      this.opts.onFatal?.(escalated);
      return;
    }

    this.transition("RECONNECTING");
    const delay = computeReconnectDelay(
      this.consecutiveFailures - 1,
      this.opts.reconnectBaseMs,
      this.opts.reconnectMaxMs,
      this.opts.reconnectJitter,
    );
    this.opts.onReconnectScheduled?.(delay);
  }

  /**
   * Cleanly disconnect — no reconnect, reset to IDLE.
   */
  disconnect(): void {
    this.transition("IDLE");
    this.consecutiveFailures = 0;
    this.lifecycleSubscribed = false;
    // Don't clear sessionRefs — they represent desired subscriptions,
    // not active ones. On reconnect, resubscribeAll() re-sends them.
  }

  // -- Subscription management ----------------------------------------------

  /**
   * Subscribe to per-session message events. Reference-counted:
   * multiple callers subscribing to the same key share one RPC subscription.
   */
  async subscribeSession(key: string): Promise<void> {
    const prev = this.sessionRefs.get(key) ?? 0;
    this.sessionRefs.set(key, prev + 1);

    // Only send RPC on first subscription for this key
    if (prev === 0 && this._state === "ACTIVE") {
      await this.opts.sendRpc("sessions.messages.subscribe", { key });
    }
  }

  /**
   * Unsubscribe from per-session message events. Only sends the unsubscribe
   * RPC when the reference count reaches zero.
   */
  async unsubscribeSession(key: string): Promise<void> {
    const current = this.sessionRefs.get(key) ?? 0;
    if (current <= 1) {
      this.sessionRefs.delete(key);
      if (this._state === "ACTIVE") {
        await this.opts.sendRpc("sessions.messages.unsubscribe", { key }).catch(() => {});
      }
    } else {
      this.sessionRefs.set(key, current - 1);
    }
  }

  /**
   * Subscribe to session lifecycle events (sessions.subscribe).
   * Called once per connection — idempotent.
   */
  async subscribeLifecycle(): Promise<void> {
    if (this.lifecycleSubscribed) {
      return;
    }
    if (this._state !== "ACTIVE") {
      return;
    }
    await this.opts.sendRpc("sessions.subscribe", {});
    this.lifecycleSubscribed = true;
  }

  /**
   * Re-send all active subscriptions after a reconnect.
   * Called by gateway-adapter after handleOpen().
   */
  async resubscribeAll(): Promise<void> {
    this.lifecycleSubscribed = false;

    // Re-subscribe lifecycle
    await this.subscribeLifecycle();

    // Re-subscribe per-session messages
    const keys = Array.from(this.sessionRefs.keys());
    await Promise.allSettled(
      keys.map((key) => this.opts.sendRpc("sessions.messages.subscribe", { key })),
    );
  }

  // -- Introspection --------------------------------------------------------

  /** Get all session keys with active subscriptions. */
  getActiveSubscriptions(): ReadonlyMap<string, number> {
    return this.sessionRefs;
  }

  /** Get count of active session subscriptions. */
  get activeCount(): number {
    return this.sessionRefs.size;
  }

  /** Whether lifecycle subscription is active. */
  get isLifecycleSubscribed(): boolean {
    return this.lifecycleSubscribed;
  }

  /** Current consecutive failure count. */
  get failures(): number {
    return this.consecutiveFailures;
  }
}
