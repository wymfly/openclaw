"use client";

import { useEffect } from "react";
import { dispatchSessionStateEvent } from "@/stores/chat-dispatchers";

/**
 * Subscribe to session-state events from SSE for non-chat panels.
 * The chat panel handles these via useChatSSE; other panels use this hook.
 */
export function useSessionEvents(eventSource: EventSource | null): void {
  useEffect(() => {
    if (!eventSource) return;
    const handler = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        dispatchSessionStateEvent(payload);
      } catch {
        // Ignore malformed events
      }
    };
    eventSource.addEventListener("session-state", handler);
    return () => eventSource.removeEventListener("session-state", handler);
  }, [eventSource]);
}
