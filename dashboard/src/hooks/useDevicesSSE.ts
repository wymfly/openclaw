"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
import { useDevicesStore } from "@/stores/devices";
import { useNotificationsStore } from "@/stores/notifications";

export function useDevicesSSE() {
  const fetchDevices = useDevicesStore((s) => s.fetchDevices);
  const addToast = useNotificationsStore((s) => s.addToast);
  const t = useTranslations("devices");

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
          if (event.event === "device.pair.requested") {
            const payload = JSON.parse(event.data) as {
              displayName?: string;
              role?: string;
            };
            addToast(
              "info",
              t("toastNewRequest", {
                name: payload.displayName ?? "Unknown",
                role: payload.role ?? "unknown",
              }),
              8000,
            );
            void fetchDevices();
          } else if (event.event === "device.pair.resolved") {
            void fetchDevices();
          }
        } catch {
          // Ignore malformed SSE payloads
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [fetchDevices, addToast, t]);
}
