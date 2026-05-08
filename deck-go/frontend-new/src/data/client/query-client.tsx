import { QueryClient, type DefaultOptions } from "@tanstack/react-query";
import { normalizeDataFabricError } from "../errors/error-handler";
import { controlledReadRetry } from "../errors/retry-policy";

export const dataFabricDefaultOptions = {
  queries: {
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    retry: controlledReadRetry,
    staleTime: 60_000,
    throwOnError: false,
  },
  mutations: {
    networkMode: "online",
    retry: false,
    throwOnError: false,
  },
} satisfies DefaultOptions;

export function createDataFabricQueryClient() {
  return new QueryClient({
    defaultOptions: dataFabricDefaultOptions,
  });
}

export function toDataFabricQueryError(error: unknown) {
  return normalizeDataFabricError(error);
}
