"use client";

import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
import { useAgentsStore } from "@/stores/agents";

/**
 * SSE hook that listens for `agent.status.changed` events and updates
 * the agents store in real-time. Follows the deckStream + AbortController
 * pattern established by useDevicesSSE / useActivitySSE.
 */
export function useAgentStatusSSE() {
  const updateAgent = useAgentsStore((s) => s.updateAgent);

  useEffect(() => {
    const controller = new AbortController();
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        if (event.event !== "agent.status.changed" || !event.data) {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as {
            agentId?: string;
            status?: string;
          };
          if (
            payload.agentId &&
            payload.status &&
            (payload.status === "idle" ||
              payload.status === "busy" ||
              payload.status === "error" ||
              payload.status === "offline")
          ) {
            updateAgent(payload.agentId, { status: payload.status });
          }
        } catch {
          // Ignore malformed SSE payloads
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [updateAgent]);
}
