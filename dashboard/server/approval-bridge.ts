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

import type { DeckRuntime } from "./runtime.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingApproval {
  id: string;
  command: string;
  commandArgv?: string[];
  agentId?: string;
  cwd?: string;
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

export function initApprovalBridge(runtime: DeckRuntime): void {
  const { eventBus } = runtime;
  const pendingMap = getPendingMap();

  // Listen for EventBus events that originate from the Gateway WS domain event bridge.
  // The runtime's bridgeDomainEvent already maps gateway.event inner names to EventBus
  // broadcasts. However, approval events arrive as gateway.event with inner event names
  // like "exec.approval.requested" — which are NOT in the VALID_DECK_EVENTS set and
  // therefore get broadcast as generic "gateway.event". We subscribe to "gateway.event"
  // and inspect the payload for approval-specific events.
  eventBus.subscribe((event) => {
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
      const approval: PendingApproval = {
        id: typeof innerPayload.id === "string" ? innerPayload.id : "",
        command: typeof innerPayload.command === "string" ? innerPayload.command : "",
        commandArgv: Array.isArray(innerPayload.commandArgv)
          ? (innerPayload.commandArgv as string[])
          : undefined,
        agentId: typeof innerPayload.agentId === "string" ? innerPayload.agentId : undefined,
        cwd: typeof innerPayload.cwd === "string" ? innerPayload.cwd : undefined,
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
        pendingMap.delete(id);
        eventBus.broadcast("approval.resolved", { id, ...innerPayload });
      }
    }
  });
}
