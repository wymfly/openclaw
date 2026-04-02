"use client";

import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
import { useNotificationsStore, type ToastType } from "@/stores/notifications";

interface ToastEvent {
  type?: ToastType;
  message?: string;
  duration?: number;
}

/**
 * Hook that subscribes to the SSE stream and bridges
 * `notification.toast` events into the Zustand toast store.
 *
 * Reconnection: The native EventSource API automatically reconnects with
 * ~3 s delay. The server supports `Last-Event-ID` replay, so no events
 * are lost during brief disconnections.
 */
export function useNotificationSSE(): void {
  const addToast = useNotificationsStore((s) => s.addToast);

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
          if (event.event === "notification.toast") {
            const data = JSON.parse(event.data) as ToastEvent;
            const type = data.type ?? "info";
            const message = data.message ?? "";
            if (message) {
              addToast(type, message, data.duration);
            }
            return;
          }
          if (event.event === "alert.fired") {
            const data = JSON.parse(event.data);
            void import("@/stores/alerts").then(({ useAlertsStore }) => {
              useAlertsStore.getState().addFiredAlert(data);
            });
          }
        } catch {
          // Malformed payload — ignore.
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [addToast]);
}
