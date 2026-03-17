"use client";

import { useEffect } from "react";
import { useActivityStore, type ActivityEvent } from "@/stores/activity";

/**
 * Listen for "activity.event" events from the existing SSE stream at `/api/stream`.
 * Adds new events to the activity store in real-time.
 *
 * Reconnection: The native EventSource API automatically reconnects with
 * ~3 s delay. The server supports `Last-Event-ID` replay, so no events
 * are lost during brief disconnections.
 */
export function useActivitySSE() {
  const addEvent = useActivityStore((s) => s.addEvent);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.addEventListener("activity.event", (e) => {
      try {
        const payload = JSON.parse(e.data) as ActivityEvent;
        if (payload.id && payload.description) {
          addEvent({
            id: payload.id,
            timestamp: payload.timestamp ?? Date.now(),
            type: payload.type ?? "system",
            agentId: payload.agentId,
            agentName: payload.agentName,
            description: payload.description,
            details: payload.details,
          });
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    });

    return () => es.close();
  }, [addEvent]);
}
