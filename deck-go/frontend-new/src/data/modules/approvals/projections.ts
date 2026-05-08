import type { QueryClient } from "@tanstack/react-query";
import {
  useLiveProjectionSubscription,
  type LiveProjectionSubscriptionOptions,
} from "../../../hooks/useLiveProjectionSubscription";
import { approvalsKeys } from "./keys";

type ApprovalProjectionEvent = {
  projection?: string;
  projectionId?: string;
  type?: string;
  event?: string;
};

const supportedEvents = new Set(["approval.pending", "approval.resolved", "projection.gap"]);

function eventType(event: ApprovalProjectionEvent) {
  return event.type ?? event.event ?? "";
}

function projectionId(event: ApprovalProjectionEvent) {
  return event.projection ?? event.projectionId ?? "";
}

export async function applyApprovalQueueInvalidation(
  queryClient: QueryClient,
  event: ApprovalProjectionEvent,
) {
  if (projectionId(event) !== "approval-queue" || !supportedEvents.has(eventType(event))) {
    return false;
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: approvalsKeys.pending() }),
    queryClient.invalidateQueries({ queryKey: approvalsKeys.plugins() }),
    queryClient.invalidateQueries({ queryKey: approvalsKeys.all() }),
  ]);
  return true;
}

export function useApprovalQueueProjectionSubscription(
  options: Omit<LiveProjectionSubscriptionOptions, "projectionId">,
) {
  useLiveProjectionSubscription({
    projectionId: "approval-queue",
    ...options,
  });
}
