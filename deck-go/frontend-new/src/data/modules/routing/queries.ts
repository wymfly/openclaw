import { useQuery } from "@tanstack/react-query";
import { fetchActivityEvents, fetchRoutingBindings } from "@/api";
import type { DeckGoActivityResponse, DeckGoRoutingListResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { routingKeys, type RoutingFilters } from "./keys";

export function routingBindingsQueryOptions(
  bff: DataFabricBffTransport,
  filters?: RoutingFilters,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoRoutingListResponse>(
    bff,
    bffSource("GET /deck/routing", () => fetchRoutingBindings(filters)),
    routingKeys.bindings(filters, scope),
    "config-authority",
  );
}

export function useRoutingBindingsQuery(filters?: RoutingFilters & ModuleQueryOptions) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...routingBindingsQueryOptions(bff, filters, filters?.scope),
    enabled: filters?.enabled ?? true,
  });
}

export function routingActivityQueryOptions(
  bff: DataFabricBffTransport,
  limit = 20,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoActivityResponse>(
    bff,
    bffSource("GET /activity", () => fetchActivityEvents(limit)),
    routingKeys.activity(limit, scope),
    "historical",
  );
}

export function useRoutingActivityQuery(limit = 20, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...routingActivityQueryOptions(bff, limit, options.scope),
    enabled: options.enabled ?? true,
  });
}
