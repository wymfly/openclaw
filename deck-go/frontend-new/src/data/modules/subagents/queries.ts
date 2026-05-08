import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSubagentLineage, fetchSubagentRuns } from "@/api";
import type { DeckGoSubagentsLineageResponse, DeckGoSubagentsListResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { subagentsKeys, type SubagentLineageParams, type SubagentRunsFilters } from "./keys";

export function subagentRunsQueryOptions(
  bff: DataFabricBffTransport,
  filters: SubagentRunsFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoSubagentsListResponse>(
    bff,
    bffSource("GET /deck/subagents", () => fetchSubagentRuns(filters)),
    subagentsKeys.runs(filters, scope),
    "live-workbench",
  );
}

export function subagentLineageQueryOptions(
  bff: DataFabricBffTransport,
  params: SubagentLineageParams,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoSubagentsLineageResponse>(
    bff,
    bffSource("POST /deck/subagents", () => fetchSubagentLineage(params)),
    subagentsKeys.lineage(params, scope),
    "lazy-detail",
  );
}

function hasLineageTarget(params: SubagentLineageParams | null | undefined) {
  return Boolean(params?.runId?.trim() || params?.sessionKey?.trim());
}

export function useSubagentRunsQuery(
  filters: SubagentRunsFilters = {},
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...subagentRunsQueryOptions(bff, filters, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useSubagentLineageQuery(
  params: SubagentLineageParams | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeParams = params ?? {};
  return useQuery({
    ...subagentLineageQueryOptions(bff, safeParams, options.scope),
    enabled: hasLineageTarget(params) && (options.enabled ?? true),
  });
}

export function useSubagentLineageFetcher() {
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  return (params: SubagentLineageParams, scope?: DeckQueryScope) =>
    queryClient.fetchQuery(subagentLineageQueryOptions(bff, params, scope));
}
