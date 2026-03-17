/**
 * Approval Bridge — connects Gateway approval events to the Deck EventBus.
 *
 * Phase 1 Agent C will implement the full approval workflow:
 * - Listen for exec.approval events from Gateway
 * - Broadcast approval.pending / approval.resolved via EventBus
 * - Persist approval state for the Approvals panel
 */

import type { DeckRuntime } from "./runtime.js";

export function initApprovalBridge(_runtime: DeckRuntime): void {
  /* Phase 1 Agent C will implement */
}
