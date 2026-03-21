/**
 * Approval Bridge — connects Gateway approval events to the Deck EventBus.
 *
 * Listens for Gateway WS events:
 *   - `exec.approval.requested` → add to in-memory Map + broadcast "approval.pending"
 *   - `exec.approval.resolved`  → remove from Map + broadcast "approval.resolved"
 *
 * Maintains an in-memory Map<string, PendingApproval> for refresh recovery
 * (GET /api/approvals/pending returns current map entries).
 */

import type { DeckRuntime } from "./runtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingApproval {
  id: string;
  command: string;
  commandArgv?: string[];
  agentId?: string;
  cwd?: string;
  sessionKey?: string;
  createdAtMs: number;
  expiresAtMs: number;
}

// ---------------------------------------------------------------------------
// In-memory pending approvals map (globalThis singleton for HMR safety)
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckPendingApprovals__";

type PendingMap = Map<string, PendingApproval>;

function getPendingMap(): PendingMap {
  const g = globalThis as unknown as Record<string, PendingMap | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

/** Return current pending approvals as an array (for GET /api/approvals/pending). */
export function getPendingApprovals(): PendingApproval[] {
  return Array.from(getPendingMap().values());
}

// ---------------------------------------------------------------------------
// Bridge initialization
// ---------------------------------------------------------------------------

export function initApprovalBridge(runtime: DeckRuntime): () => void {
  const { eventBus } = runtime;
  const pendingMap = getPendingMap();

  // F7: Periodic expiry sweep — removes entries where expiresAtMs has passed.
  const expiryTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, approval] of pendingMap) {
      if (approval.expiresAtMs && approval.expiresAtMs < now) {
        pendingMap.delete(id);
      }
    }
  }, 30_000);

  // Listen for EventBus events that originate from the Gateway WS domain event bridge.
  const subscriber = (event: { type: string; data: unknown }) => {
    if (event.type !== "gateway.event") {
      return;
    }

    const payload = event.data as Record<string, unknown> | undefined;
    if (!payload) {
      return;
    }

    // The bridgeDomainEvent wraps unknown inner events as the full ControlPlaneDomainEvent.
    const innerEvent = (payload as { event?: string }).event;
    if (!innerEvent) {
      return;
    }

    const innerPayload = (payload as { payload?: unknown }).payload as
      | Record<string, unknown>
      | undefined;

    if (innerEvent === "exec.approval.requested" && innerPayload) {
      // Gateway broadcasts { id, request: { command, agentId, commandArgv, cwd, ... },
      // createdAtMs, expiresAtMs }.  The command/agentId are nested inside `request`.
      const request =
        typeof innerPayload.request === "object" && innerPayload.request !== null
          ? (innerPayload.request as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const approval: PendingApproval = {
        id: typeof innerPayload.id === "string" ? innerPayload.id : "",
        command: typeof request.command === "string" ? request.command : "",
        commandArgv: Array.isArray(request.commandArgv)
          ? (request.commandArgv as string[])
          : undefined,
        agentId: typeof request.agentId === "string" ? request.agentId : undefined,
        cwd: typeof request.cwd === "string" ? request.cwd : undefined,
        sessionKey: typeof request.sessionKey === "string" ? request.sessionKey : undefined,
        createdAtMs: Number(innerPayload.createdAtMs ?? Date.now()),
        expiresAtMs: Number(innerPayload.expiresAtMs ?? Date.now() + 300_000),
      };

      if (approval.id) {
        pendingMap.set(approval.id, approval);
        eventBus.broadcast("approval.pending", approval);
      }
    } else if (innerEvent === "exec.approval.resolved" && innerPayload) {
      const id = typeof innerPayload.id === "string" ? innerPayload.id : "";
      if (id) {
        // Retrieve sessionKey from pending map before deleting; fall back to
        // the Gateway's request.sessionKey if the entry was already expired.
        const pending = pendingMap.get(id);
        const request =
          typeof innerPayload.request === "object" && innerPayload.request !== null
            ? (innerPayload.request as Record<string, unknown>)
            : undefined;
        const sessionKey =
          pending?.sessionKey ??
          (typeof request?.sessionKey === "string" ? request.sessionKey : undefined);
        pendingMap.delete(id);
        eventBus.broadcast("approval.resolved", { id, sessionKey, ...innerPayload });
      }
    }
  };

  eventBus.subscribe(subscriber);

  // F12: Return cleanup function for HMR safety
  return () => {
    clearInterval(expiryTimer);
    eventBus.unsubscribe(subscriber);
  };
}
