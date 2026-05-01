import { useCallback, useEffect, useState } from "react";
import type { DeckGoRuntimeCapabilities } from "../../../contracts/generated/ts/deck-api.generated";
import { fetchCapabilities } from "../api";

let cachedCapabilities: DeckGoRuntimeCapabilities | null = null;
const subscribers = new Set<(capabilities: DeckGoRuntimeCapabilities | null) => void>();

function publishCapabilities(next: DeckGoRuntimeCapabilities | null) {
  cachedCapabilities = next;
  for (const subscriber of subscribers) {
    subscriber(next);
  }
}

export function useCapabilities() {
  const [snapshot, setSnapshot] = useState({
    capabilities: cachedCapabilities,
    error: "",
    loading: cachedCapabilities == null,
  });

  const refresh = useCallback(async () => {
    setSnapshot((current) => ({ ...current, loading: true }));
    try {
      const next = await fetchCapabilities();
      publishCapabilities(next);
      setSnapshot({ capabilities: next, error: "", loading: false });
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : "runtime capabilities fetch failed";
      setSnapshot((current) => ({ ...current, error: message, loading: false }));
      return null;
    }
  }, []);

  useEffect(() => {
    const subscriber = (capabilities: DeckGoRuntimeCapabilities | null) => {
      setSnapshot((current) => ({ ...current, capabilities }));
    };
    subscribers.add(subscriber);
    void refresh();
    return () => {
      subscribers.delete(subscriber);
    };
  }, [refresh]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  return { ...snapshot, refresh };
}
