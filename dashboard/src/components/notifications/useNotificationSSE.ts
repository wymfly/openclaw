"use client";

import { useEffect } from "react";
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
    const es = new EventSource("/api/stream");

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as ToastEvent;
        const type = data.type ?? "info";
        const message = data.message ?? "";
        if (message) {
          addToast(type, message, data.duration);
        }
      } catch {
        // Malformed payload — ignore.
      }
    };

    es.addEventListener("notification.toast", handler);

    // F9: Bridge alert.fired SSE events to the alerts store
    const alertHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        // Dynamic import to avoid circular deps and keep bundle splitting
        void import("@/stores/alerts").then(({ useAlertsStore }) => {
          useAlertsStore.getState().addFiredAlert(data);
        });
      } catch {
        // Malformed payload — ignore.
      }
    };

    es.addEventListener("alert.fired", alertHandler);

    return () => {
      es.removeEventListener("notification.toast", handler);
      es.removeEventListener("alert.fired", alertHandler);
      es.close();
    };
  }, [addToast]);
}
