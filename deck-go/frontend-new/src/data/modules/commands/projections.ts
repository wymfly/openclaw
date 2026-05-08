import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  useLiveProjectionSubscription,
  type LiveProjectionSubscriptionOptions,
} from "../../../hooks/useLiveProjectionSubscription";
import { commandsKeys } from "./keys";

type CommandProjectionEvent = {
  agentId?: string;
  event?: string;
  projection?: string;
  projectionId?: string;
  type?: string;
};

const supportedEvents = new Set(["commands.changed", "projection.gap"]);

function eventType(event: CommandProjectionEvent) {
  return event.type ?? event.event ?? "";
}

function projectionId(event: CommandProjectionEvent) {
  return event.projection ?? event.projectionId ?? "";
}

export async function applyCommandDiscoveryInvalidation(
  queryClient: QueryClient,
  event: CommandProjectionEvent,
  agentId?: string | null,
) {
  const id = projectionId(event);
  if (id && id !== "command-discovery") {
    return false;
  }
  if (!supportedEvents.has(eventType(event))) {
    return false;
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: commandsKeys.all() }),
    queryClient.invalidateQueries({ queryKey: commandsKeys.discovery(agentId ?? event.agentId) }),
  ]);
  return true;
}

export function useCommandDiscoveryProjectionInvalidation(
  agentId?: string | null,
  options: Omit<
    LiveProjectionSubscriptionOptions,
    "onEvent" | "onProjectionGap" | "projectionId"
  > = {},
) {
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    (event: CommandProjectionEvent) =>
      applyCommandDiscoveryInvalidation(queryClient, event, agentId),
    [agentId, queryClient],
  );

  useLiveProjectionSubscription({
    projectionId: "command-discovery",
    ...options,
    onEvent: (event) => {
      void invalidate(event);
    },
    onProjectionGap: async () => {
      await invalidate({
        event: "projection.gap",
        projectionId: "command-discovery",
      });
    },
  });
}
