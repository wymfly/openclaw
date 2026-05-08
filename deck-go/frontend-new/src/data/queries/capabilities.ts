import { useQuery } from "@tanstack/react-query";
import { fetchCapabilities } from "@/api";
import type { DeckGoRuntimeCapabilities } from "@/api-types";
import { useDataFabricTransports } from "../client/scoped-query-provider";
import type { DeckQueryScope } from "../contracts/query-keys";
import { deckKeys } from "../contracts/query-keys";
import { bffQueryOptions, bffSource, type DataFabricBffTransport } from "../modules/shared";

export const runtimeCapabilitiesSource = bffSource<DeckGoRuntimeCapabilities>(
  "GET /runtime/capabilities",
  () => fetchCapabilities(),
);

export function runtimeCapabilitiesQueryOptions(
  bff: DataFabricBffTransport,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoRuntimeCapabilities>(
    bff,
    runtimeCapabilitiesSource,
    [...deckKeys.runtime.all(scope), "capabilities"] as const,
    "runtime-liveness",
  );
}

export function useRuntimeCapabilitiesQuery(
  options: { enabled?: boolean; scope?: DeckQueryScope } = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...runtimeCapabilitiesQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}
