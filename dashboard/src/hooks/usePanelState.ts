"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PanelStatus = "loading" | "error" | "empty" | "data";

export interface PanelState<T> {
  status: PanelStatus;
  data: T | undefined;
  error: string | undefined;
  retry: () => void;
}

interface UsePanelStateOptions<T> {
  /** Async function that fetches the panel data. */
  fetchFn: () => Promise<T>;
  /** Returns true when the fetched data should be treated as "empty". */
  isEmpty: (data: T) => boolean;
}

/**
 * Manages the four-state lifecycle for a panel:
 * loading → data | empty | error.
 *
 * Provides a `retry` callback that re-runs the fetch.
 */
export function usePanelState<T>({ fetchFn, isEmpty }: UsePanelStateOptions<T>): PanelState<T> {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  // Keep refs to avoid stale closures in retry.
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;

  const load = useCallback(async () => {
    setStatus("loading");
    setError(undefined);
    try {
      const result = await fetchRef.current();
      if (isEmptyRef.current(result)) {
        setData(result);
        setStatus("empty");
      } else {
        setData(result);
        setStatus("data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { status, data, error, retry: load };
}
