"use client";

import { useEffect } from "react";
import { useApprovalsStore, type PendingApproval } from "@/stores/approvals";

/** Subscribe to SSE approval events and update the store in real-time. */
export function useApprovalsSSE() {
  const addPending = useApprovalsStore((s) => s.addPending);
  const removePending = useApprovalsStore((s) => s.removePending);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.addEventListener("approval.pending", (e) => {
      try {
        const payload = JSON.parse(e.data) as PendingApproval;
        if (payload.id) {
          addPending(payload);
        }
      } catch {
        // Ignore malformed SSE payloads
      }
    });

    es.addEventListener("approval.resolved", (e) => {
      try {
        const payload = JSON.parse(e.data) as { id: string };
        if (payload.id) {
          removePending(payload.id);
        }
      } catch {
        // Ignore malformed SSE payloads
      }
    });

    return () => es.close();
  }, [addPending, removePending]);
}
