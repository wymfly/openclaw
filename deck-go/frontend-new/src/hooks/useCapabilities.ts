import { useCallback } from "react";
import { useRuntimeCapabilitiesQuery } from "../data/queries/capabilities";

export function useCapabilities() {
  const query = useRuntimeCapabilitiesQuery();

  const refresh = useCallback(async () => {
    const result = await query.refetch();
    return result.data ?? null;
  }, [query]);

  return {
    capabilities: query.data ?? null,
    error:
      query.error instanceof Error
        ? query.error.message
        : query.error
          ? "runtime capabilities fetch failed"
          : "",
    loading: query.isFetching,
    refresh,
  };
}
