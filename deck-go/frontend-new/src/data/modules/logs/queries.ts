import { useQuery } from "@tanstack/react-query";
import { fetchLogsTail } from "@/api";
import type { DeckGoLogsTailResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { logsKeys, type LogsTailFilters } from "./keys";

export function logsTailQueryOptions(
  bff: DataFabricBffTransport,
  filters: LogsTailFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoLogsTailResponse>(
    bff,
    bffSource("GET /logs", () => fetchLogsTail(filters)),
    logsKeys.tail(filters, scope),
    "stream-driven",
  );
}

export function useLogsTailQuery(filters: LogsTailFilters = {}, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...logsTailQueryOptions(bff, filters, options.scope),
    enabled: options.enabled ?? true,
  });
}
