import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLiveProjectionSubscription } from "../../../hooks/useLiveProjectionSubscription";
import { settingsKeys } from "./keys";

type DevicePairingEvent = {
  projection?: string;
  type?: string;
};

export type DevicePairingProjectionEvent = {
  data?: string;
  event?: string;
  json?: unknown;
};

type DevicePairingProjectionSubscriptionOptions = {
  onDeviceEvent?: (event: DevicePairingProjectionEvent) => void;
  retryDelayMs?: number;
};

export async function applyDevicePairingInvalidation(
  queryClient: QueryClient,
  event: DevicePairingEvent,
) {
  if (event.projection && event.projection !== "device-pairing") {
    return;
  }
  if (
    event.type !== "device.pair.requested" &&
    event.type !== "device.pair.resolved" &&
    event.type !== "projection.gap"
  ) {
    return;
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: settingsKeys.devices() }),
    queryClient.invalidateQueries({ queryKey: settingsKeys.selfDevice() }),
  ]);
}

export function useDevicePairingProjectionSubscription(
  options: DevicePairingProjectionSubscriptionOptions = {},
) {
  const queryClient = useQueryClient();
  const { onDeviceEvent, retryDelayMs = 1_000 } = options;

  const onEvent = useCallback(
    (event: DevicePairingProjectionEvent) => {
      if (event.event !== "device.pair.requested" && event.event !== "device.pair.resolved") {
        return;
      }
      onDeviceEvent?.(event);
      window.setTimeout(() => {
        void applyDevicePairingInvalidation(queryClient, {
          projection: "device-pairing",
          type: event.event,
        });
      }, 0);
    },
    [onDeviceEvent, queryClient],
  );

  const onProjectionGap = useCallback(() => {
    window.setTimeout(() => {
      void applyDevicePairingInvalidation(queryClient, {
        projection: "device-pairing",
        type: "projection.gap",
      });
    }, 0);
  }, [queryClient]);

  useLiveProjectionSubscription({
    projectionId: "device-pairing",
    retryDelayMs,
    onEvent,
    onProjectionGap,
  });
}
