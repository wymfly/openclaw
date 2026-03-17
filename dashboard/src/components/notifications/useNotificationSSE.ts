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

    return () => {
      es.removeEventListener("notification.toast", handler);
      es.close();
    };
  }, [addToast]);
}
