import { useQuery } from "@tanstack/react-query";
import { fetchThreads } from "@/api";
import type { DeckGoThreadsResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { threadsKeys, type ThreadsFilters } from "./keys";

export function threadsListQueryOptions(
  bff: DataFabricBffTransport,
  filters: ThreadsFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoThreadsResponse>(
    bff,
    bffSource("GET /deck/threads", () => fetchThreads(filters)),
    threadsKeys.list(filters, scope),
    "inventory",
  );
}

export function useThreadsListQuery(
  filters: ThreadsFilters = {},
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...threadsListQueryOptions(bff, filters, options.scope),
    enabled: options.enabled ?? true,
  });
}
