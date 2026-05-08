import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  deckGoLiveProjectionContract,
  type DeckGoLiveProjectionId,
} from "../../../contracts/generated/ts/deck-live-projections.generated";
import { deckKeys } from "./contracts/query-keys";

export type DataFabricLiveEvent = {
  event: string;
  projectionId?: DeckGoLiveProjectionId;
};

export type DataFabricLiveInvalidationPolicy = {
  endpointKeys?: Record<string, readonly QueryKey[]>;
};

export type DataFabricLiveInvalidationResult = {
  invalidatedKeys: readonly QueryKey[];
  projectionId?: DeckGoLiveProjectionId;
  refreshEndpoints: readonly string[];
  stale: boolean;
};

const runtimeGatewayEvents = new Set([
  "runtime.gateway.status",
  "runtime.gateway.health",
  "runtime.gateway.exit",
]);

function findProjection(id: DeckGoLiveProjectionId | undefined) {
  if (!id) {
    return undefined;
  }
  return deckGoLiveProjectionContract.projections.find((projection) => projection.id === id);
}

export function resolveDataFabricLiveInvalidation(
  event: DataFabricLiveEvent,
  policy: DataFabricLiveInvalidationPolicy = {},
): DataFabricLiveInvalidationResult {
  if (runtimeGatewayEvents.has(event.event)) {
    return {
      invalidatedKeys: [deckKeys.runtime.all()],
      refreshEndpoints: [],
      stale: false,
    };
  }

  const projection = findProjection(event.projectionId);
  if (!projection || event.event !== "projection.gap" || projection.gapPolicy === "none") {
    return {
      invalidatedKeys: [],
      refreshEndpoints: projection?.refreshEndpoints ?? [],
      stale: false,
    };
  }

  const refreshEndpoints = projection.refreshEndpoints;
  const invalidatedKeys =
    projection.gapPolicy === "refresh"
      ? refreshEndpoints.flatMap((endpoint) => policy.endpointKeys?.[endpoint] ?? [])
      : [];

  return {
    invalidatedKeys,
    projectionId: projection.id,
    refreshEndpoints,
    stale: true,
  };
}

export async function applyDataFabricLiveInvalidation(
  queryClient: QueryClient,
  event: DataFabricLiveEvent,
  policy: DataFabricLiveInvalidationPolicy = {},
) {
  const result = resolveDataFabricLiveInvalidation(event, policy);
  await Promise.all(
    result.invalidatedKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
  return result;
}
