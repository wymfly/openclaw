import { useEffect, useMemo, useRef, useState } from "react";
import {
  deckGoLiveProjectionContract,
  type DeckGoLiveProjectionId,
  type DeckGoLiveProjectionStatus,
} from "../../../contracts/generated/ts/deck-live-projections.generated";
import {
  streamEvents,
  streamLogEvents,
  type DeckGoLogStreamEvent,
  type DeckGoServerEvent,
} from "../api";

type LiveProjection = (typeof deckGoLiveProjectionContract.projections)[number];
type StreamedLiveProjection = LiveProjection & { stream: NonNullable<LiveProjection["stream"]> };
type LiveProjectionEvent = DeckGoServerEvent | DeckGoLogStreamEvent;

export type LiveProjectionSubscriptionState = {
  status: DeckGoLiveProjectionStatus;
  stale: boolean;
  lastEventId: string;
};

export type LiveProjectionSubscriptionOptions<
  TEvent extends LiveProjectionEvent = LiveProjectionEvent,
> = {
  enabled?: boolean;
  onEvent?: (event: TEvent) => void;
  onProjectionGap?: () => void | Promise<void>;
  onStatusChange?: (state: LiveProjectionSubscriptionState) => void;
  projectionId: DeckGoLiveProjectionId;
  retryDelayMs?: number;
};

function readStoredCursor(key: string | null): string {
  if (!key || typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(key)?.trim() || "";
}

function writeStoredCursor(key: string | null, value: string | undefined): string {
  const next = value?.trim() || "";
  if (key && next && typeof window !== "undefined") {
    window.localStorage.setItem(key, next);
  }
  return next;
}

export function getLiveProjectionContract(id: DeckGoLiveProjectionId): LiveProjection {
  const projection = deckGoLiveProjectionContract.projections.find((item) => item.id === id);
  if (!projection) {
    throw new Error(`unknown live projection: ${id}`);
  }
  return projection;
}

function isStreamedProjection(projection: LiveProjection): projection is StreamedLiveProjection {
  return projection.stream !== null;
}

function isProjectionGap(event: LiveProjectionEvent): boolean {
  return event.event === "projection.gap";
}

export function useLiveProjectionSubscription<
  TEvent extends LiveProjectionEvent = LiveProjectionEvent,
>({
  enabled = true,
  onEvent,
  onProjectionGap,
  onStatusChange,
  projectionId,
  retryDelayMs,
}: LiveProjectionSubscriptionOptions<TEvent>): LiveProjectionSubscriptionState {
  const projection = useMemo(() => getLiveProjectionContract(projectionId), [projectionId]);
  const onEventRef = useRef(onEvent);
  const onProjectionGapRef = useRef(onProjectionGap);
  const staleTimerRef = useRef<number | null>(null);
  const cursorKey = projection.cursorStorageKey;
  const [state, setState] = useState<LiveProjectionSubscriptionState>(() => ({
    status: "idle",
    stale: false,
    lastEventId: readStoredCursor(cursorKey),
  }));

  useEffect(() => {
    setState((current) => ({
      ...current,
      lastEventId: readStoredCursor(cursorKey),
    }));
  }, [cursorKey]);

  useEffect(() => {
    onStatusChange?.(state);
  }, [onStatusChange, state]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onProjectionGapRef.current = onProjectionGap;
  }, [onProjectionGap]);

  useEffect(() => {
    if (!enabled || !isStreamedProjection(projection)) {
      setState((current) => ({ ...current, status: "idle", stale: false }));
      return undefined;
    }

    const controller = new AbortController();

    const clearStaleTimer = () => {
      if (staleTimerRef.current !== null) {
        window.clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
    };

    const markStatus = (status: DeckGoLiveProjectionStatus, stale = false) => {
      if (status === "connected" || status === "idle") {
        clearStaleTimer();
      }
      setState((current) => ({
        ...current,
        status,
        stale,
      }));
      if ((status === "connecting" || status === "reconnecting" || status === "error") && !stale) {
        clearStaleTimer();
        staleTimerRef.current = window.setTimeout(() => {
          setState((current) => ({ ...current, status: "stale", stale: true }));
        }, projection.staleAfterMs);
      }
    };

    const handleEvent = (event: LiveProjectionEvent) => {
      const lastEventId = writeStoredCursor(cursorKey, event.id);
      if (lastEventId) {
        setState((current) => ({ ...current, lastEventId }));
      }
      if (isProjectionGap(event) && projection.gapPolicy !== "none") {
        clearStaleTimer();
        setState((current) => ({ ...current, status: "stale", stale: true }));
        void onProjectionGapRef.current?.();
      }
      onEventRef.current?.(event as TEvent);
    };

    const streamParams = {
      signal: controller.signal,
      initialLastEventId: readStoredCursor(cursorKey),
      retryDelayMs,
      onStatusChange(status: "connecting" | "connected" | "reconnecting" | "error") {
        markStatus(status);
      },
      onEvent: handleEvent,
    };

    const streamPromise =
      projection.stream === "deck-logs"
        ? streamLogEvents(streamParams as Parameters<typeof streamLogEvents>[0])
        : streamEvents(streamParams as Parameters<typeof streamEvents>[0]);

    void streamPromise.catch(() => {
      if (!controller.signal.aborted) {
        markStatus("error");
      }
    });

    return () => {
      clearStaleTimer();
      controller.abort();
    };
  }, [cursorKey, enabled, projection, retryDelayMs]);

  return state;
}
