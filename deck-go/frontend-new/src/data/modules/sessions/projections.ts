import type { QueryClient } from "@tanstack/react-query";
import { sessionsKeys } from "./keys";

type SessionProjectionEvent = {
  projection?: string;
  projectionId?: string;
  sessionKey?: string;
  type?: string;
  event?: string;
};

const supportedEvents = new Set(["sessions.changed", "session-state", "projection.gap"]);

function eventType(event: SessionProjectionEvent) {
  return event.type ?? event.event ?? "";
}

function projectionId(event: SessionProjectionEvent) {
  return event.projection ?? event.projectionId ?? "";
}

export async function applySessionListInvalidation(
  queryClient: QueryClient,
  event: SessionProjectionEvent,
) {
  if (projectionId(event) !== "session-list" || !supportedEvents.has(eventType(event))) {
    return false;
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionsKeys.all() }),
    ...(event.sessionKey
      ? [
          queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(event.sessionKey) }),
          queryClient.invalidateQueries({ queryKey: sessionsKeys.history(event.sessionKey) }),
        ]
      : []),
  ]);
  return true;
}
