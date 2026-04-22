"use client";

import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
import { useChannelsStore } from "@/stores/channels";

/**
 * SSE hook that listens for `channel.health.changed` events and updates
 * the channels store channelHealthMap in real-time.
 */
export function useChannelHealthSSE() {
  const updateChannelHealth = useChannelsStore((s) => s.updateChannelHealth);

  useEffect(() => {
    const controller = new AbortController();
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        if (event.event !== "channel.health.changed" || !event.data) {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as {
            channelId?: string;
            status?: string;
            latencyMs?: number;
            error?: string;
            timestamp?: number;
          };
          if (
            payload.channelId &&
            payload.status &&
            (payload.status === "healthy" ||
              payload.status === "degraded" ||
              payload.status === "down" ||
              payload.status === "unknown")
          ) {
            updateChannelHealth(payload.channelId, {
              status: payload.status,
              latencyMs: payload.latencyMs,
              error: payload.error,
              lastCheckedAt: payload.timestamp ?? Date.now(),
            });
          }
        } catch {
          // Ignore malformed SSE payloads
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [updateChannelHealth]);
}
