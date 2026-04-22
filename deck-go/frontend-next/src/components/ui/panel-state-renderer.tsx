"use client";

import type { PanelState } from "@/hooks/usePanelState";
import { PanelEmptyState } from "./panel-empty-state";
import { PanelError } from "./panel-error";
import { PanelSkeleton } from "./panel-skeleton";

type SkeletonVariant = "list" | "cards" | "table" | "detail";

interface PanelStateRendererProps<T> {
  state: PanelState<T>;
  skeletonVariant?: SkeletonVariant;
  emptyIcon?: React.ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  children: (data: T) => React.ReactNode;
}

/**
 * Renders the appropriate UI based on the panel's current state:
 * - loading → PanelSkeleton
 * - empty   → PanelEmptyState
 * - error   → PanelError with retry
 * - data    → children(data)
 */
export function PanelStateRenderer<T>({
  state,
  skeletonVariant = "list",
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: PanelStateRendererProps<T>) {
  switch (state.status) {
    case "loading":
      return <PanelSkeleton variant={skeletonVariant} />;
    case "empty":
      return (
        <PanelEmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      );
    case "error":
      return <PanelError error={state.error ?? "Unknown error"} onRetry={state.retry} />;
    case "data":
      return <>{children(state.data as T)}</>;
  }
}
