import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchBootstrapStatus, fetchRuntimeGatewayStatus } from "../../api";
import type { DeckGoBootstrapStatusResponse, DeckGoRuntimeGatewayResponse } from "../../api-types";
import { useDataFabricTransports } from "../client/scoped-query-provider";
import { getDataFreshnessPolicy } from "../contracts/freshness";
import { deckKeys, type DeckQueryScope } from "../contracts/query-keys";
import { normalizeDataFabricError } from "../errors/error-handler";
import { createBffQuerySource, type DataFabricBffTransport } from "../transport/bff";

const { tier: _runtimeFreshnessTier, ...runtimeQueryDefaults } =
  getDataFreshnessPolicy("runtime-liveness");
void _runtimeFreshnessTier;

export const runtimeBootstrapSource = createBffQuerySource<DeckGoBootstrapStatusResponse>(
  "/bootstrap/status",
  () => fetchBootstrapStatus(),
);

export const runtimeGatewaySource = createBffQuerySource<DeckGoRuntimeGatewayResponse>(
  "/runtime/gateway",
  () => fetchRuntimeGatewayStatus(),
);

export function runtimeBootstrapQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return {
    ...runtimeQueryDefaults,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        return await bff(runtimeBootstrapSource, signal);
      } catch (error) {
        throw normalizeDataFabricError(error);
      }
    },
    queryKey: deckKeys.runtime.bootstrap(scope),
  };
}

export function runtimeGatewayQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return {
    ...runtimeQueryDefaults,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        return await bff(runtimeGatewaySource, signal);
      } catch (error) {
        throw normalizeDataFabricError(error);
      }
    },
    queryKey: deckKeys.runtime.gateway(scope),
  };
}

export function useRuntimeBootstrapQuery(
  options: { enabled?: boolean; scope?: DeckQueryScope } = {},
) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...runtimeBootstrapQueryOptions(transports.bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useRuntimeGatewayQuery(
  options: { enabled?: boolean; scope?: DeckQueryScope } = {},
) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...runtimeGatewayQueryOptions(transports.bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export async function fetchRuntimeSummaryWithDataFabric(
  queryClient: QueryClient,
  bff: DataFabricBffTransport,
  options: { force?: boolean; scope?: DeckQueryScope } = {},
) {
  if (options.force) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: deckKeys.runtime.bootstrap(options.scope) }),
      queryClient.invalidateQueries({ queryKey: deckKeys.runtime.gateway(options.scope) }),
    ]);
  }
  const [bootstrapResult, runtimeResult] = await Promise.all([
    queryClient.fetchQuery(runtimeBootstrapQueryOptions(bff, options.scope)),
    queryClient.fetchQuery(runtimeGatewayQueryOptions(bff, options.scope)),
  ]);
  return { bootstrapResult, runtimeResult };
}

export function useRuntimeSummaryLoader() {
  const queryClient = useQueryClient();
  const transports = useDataFabricTransports();
  return (options?: { force?: boolean; scope?: DeckQueryScope }) =>
    fetchRuntimeSummaryWithDataFabric(queryClient, transports.bff, options);
}

export function useClearRuntimeSummaryQueries() {
  const queryClient = useQueryClient();
  return (scope?: DeckQueryScope) => {
    queryClient.removeQueries({ queryKey: deckKeys.runtime.bootstrap(scope) });
    queryClient.removeQueries({ queryKey: deckKeys.runtime.gateway(scope) });
  };
}
