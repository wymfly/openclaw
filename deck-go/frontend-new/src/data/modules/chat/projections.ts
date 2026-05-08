import type { QueryClient } from "@tanstack/react-query";
import {
  useLiveProjectionSubscription,
  type LiveProjectionSubscriptionOptions,
} from "../../../hooks/useLiveProjectionSubscription";
import { sessionsKeys } from "../sessions/keys";
import { chatKeys } from "./keys";

type ChatProjectionEvent = {
  event?: string;
  projection?: string;
  projectionId?: string;
  sessionKey?: string;
  type?: string;
};

const supportedEvents = new Set([
  "chat",
  "agent",
  "session.message",
  "session.tool",
  "sessions.changed",
  "session-msg",
  "session-tool",
  "session-state",
  "approval.pending",
  "approval.resolved",
  "canvas",
  "projection.gap",
]);

function eventType(event: ChatProjectionEvent) {
  return event.type ?? event.event ?? "";
}

function projectionId(event: ChatProjectionEvent) {
  return event.projection ?? event.projectionId ?? "";
}

export async function applyChatSessionInvalidation(
  queryClient: QueryClient,
  event: ChatProjectionEvent,
) {
  const id = projectionId(event);
  if (id && id !== "chat-session") {
    return false;
  }
  if (!supportedEvents.has(eventType(event))) {
    return false;
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chatKeys.all() }),
    queryClient.invalidateQueries({ queryKey: sessionsKeys.all() }),
    ...(event.sessionKey
      ? [
          queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(event.sessionKey) }),
          queryClient.invalidateQueries({ queryKey: sessionsKeys.history(event.sessionKey) }),
          queryClient.invalidateQueries({
            queryKey: sessionsKeys.compactionCheckpoints(event.sessionKey),
          }),
        ]
      : []),
  ]);
  return true;
}

export function useChatSessionProjectionSubscription(
  options: Omit<LiveProjectionSubscriptionOptions, "projectionId">,
) {
  useLiveProjectionSubscription({
    projectionId: "chat-session",
    ...options,
  });
}
