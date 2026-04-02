"use client";

import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
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
    const controller = new AbortController();
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        if (event.event !== "activity.event" || !event.data) {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as ActivityEvent;
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
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [addEvent]);
}
