"use client";

import { useEffect } from "react";
import { dispatchSessionStateEvent } from "@/stores/chat-dispatchers";
import { useSessionsStore } from "@/stores/sessions";

/**
 * Subscribe to session-state events from SSE for non-chat panels.
 * The chat panel handles these via useChatSSE; other panels use this hook.
 * Also updates the sessions store with lifecycle data from sessions.changed events.
 */
export function useSessionEvents(eventSource: EventSource | null): void {
  useEffect(() => {
    if (!eventSource) return;
    const handler = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        dispatchSessionStateEvent(payload);
        // Also update the sessions store for real-time session list updates
        useSessionsStore.getState().applySessionChangedEvent(payload);
      } catch {
        // Ignore malformed events
      }
    };
    eventSource.addEventListener("session-state", handler);
    return () => eventSource.removeEventListener("session-state", handler);
  }, [eventSource]);
}
