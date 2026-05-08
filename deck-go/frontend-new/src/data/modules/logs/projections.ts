import type { QueryClient } from "@tanstack/react-query";
import type { DeckGoLogStreamEvent } from "../../../../../contracts/generated/ts/deck-api.generated";
import {
  useLiveProjectionSubscription,
  type LiveProjectionSubscriptionState,
} from "../../../hooks/useLiveProjectionSubscription";
import { logsKeys } from "./keys";

type LogTailEvent = {
  projection?: string;
  projectionId?: string;
  type?: string;
  event?: string;
};

const supportedEvents = new Set(["log.batch", "log.reset"]);

function eventType(event: LogTailEvent) {
  return event.type ?? event.event ?? "";
}

function projectionId(event: LogTailEvent) {
  return event.projection ?? event.projectionId ?? "";
}

export async function applyLogTailInvalidation(queryClient: QueryClient, event: LogTailEvent) {
  if (projectionId(event) !== "log-tail" || !supportedEvents.has(eventType(event))) {
    return false;
  }
  await queryClient.invalidateQueries({ queryKey: logsKeys.all() });
  return true;
}

export function useLogTailProjectionSubscription({
  enabled,
  onEvent,
  onStatusChange,
}: {
  enabled: boolean;
  onEvent: (event: DeckGoLogStreamEvent) => void;
  onStatusChange: (state: LiveProjectionSubscriptionState) => void;
}) {
  useLiveProjectionSubscription({
    projectionId: "log-tail",
    enabled,
    onEvent,
    onStatusChange,
  });
}
