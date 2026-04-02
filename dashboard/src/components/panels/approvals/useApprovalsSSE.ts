"use client";

import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
import { useApprovalsStore, type PendingApproval } from "@/stores/approvals";

/**
 * Subscribe to SSE approval events and update the store in real-time.
 *
 * Reconnection: The native EventSource API automatically reconnects with
 * ~3 s delay. The server supports `Last-Event-ID` replay, so no events
 * are lost during brief disconnections.
 */
export function useApprovalsSSE() {
  const addPending = useApprovalsStore((s) => s.addPending);
  const removePending = useApprovalsStore((s) => s.removePending);

  useEffect(() => {
    const controller = new AbortController();
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        if (!event.event || !event.data) {
          return;
        }
        try {
          if (event.event === "approval.pending") {
            const payload = JSON.parse(event.data) as PendingApproval;
            if (payload.id) {
              addPending(payload);
            }
          } else if (event.event === "approval.resolved") {
            const payload = JSON.parse(event.data) as { id: string };
            if (payload.id) {
              removePending(payload.id);
            }
          }
        } catch {
          // Ignore malformed SSE payloads
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [addPending, removePending]);
}
