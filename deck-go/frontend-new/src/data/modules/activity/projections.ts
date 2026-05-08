import type { QueryClient } from "@tanstack/react-query";
import {
  useLiveProjectionSubscription,
  type LiveProjectionSubscriptionOptions,
} from "../../../hooks/useLiveProjectionSubscription";
import { activityKeys } from "./keys";

type ActivityProjectionEvent = {
  projection?: string;
  projectionId?: string;
  type?: string;
  event?: string;
};

const supportedEvents = new Set(["activity.event", "chat", "agent", "projection.gap"]);

function eventType(event: ActivityProjectionEvent) {
  return event.type ?? event.event ?? "";
}

function projectionId(event: ActivityProjectionEvent) {
  return event.projection ?? event.projectionId ?? "";
}

export async function applyActivityFeedInvalidation(
  queryClient: QueryClient,
  event: ActivityProjectionEvent,
) {
  if (projectionId(event) !== "activity-feed" || !supportedEvents.has(eventType(event))) {
    return false;
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: activityKeys.events() }),
    queryClient.invalidateQueries({ queryKey: activityKeys.monitorRuns() }),
    queryClient.invalidateQueries({ queryKey: activityKeys.monitorStats() }),
  ]);
  return true;
}

export function useActivityFeedProjectionSubscription(
  options: Omit<LiveProjectionSubscriptionOptions, "projectionId">,
) {
  useLiveProjectionSubscription({
    projectionId: "activity-feed",
    ...options,
  });
}
