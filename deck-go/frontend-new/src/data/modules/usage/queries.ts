import { useQuery } from "@tanstack/react-query";
import {
  fetchModelUsageCost,
  fetchModelUsageProviders,
  fetchUsageSessionLogs,
  fetchUsageSessions,
  fetchUsageTimeseries,
} from "@/api";
import type {
  DeckGoUsageCostResponse,
  DeckGoUsageProvidersResponse,
  DeckGoUsageSessionLogsResponse,
  DeckGoUsageSessionsResponse,
  DeckGoUsageTimeseriesResponse,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import {
  usageKeys,
  type UsageSessionLogsFilters,
  type UsageSessionsFilters,
  type UsageTimeseriesFilters,
} from "./keys";

export function usageCostQueryOptions(
  bff: DataFabricBffTransport,
  days = 14,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageCostResponse>(
    bff,
    bffSource("GET /usage/cost", () => fetchModelUsageCost(days)),
    usageKeys.cost(days, scope),
    "historical",
  );
}

export function usageProvidersQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoUsageProvidersResponse>(
    bff,
    bffSource("GET /usage/providers", () => fetchModelUsageProviders()),
    usageKeys.providers(scope),
    "historical",
  );
}

export function usageSessionsQueryOptions(
  bff: DataFabricBffTransport,
  filters: UsageSessionsFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageSessionsResponse>(
    bff,
    bffSource("GET /usage/sessions", () => fetchUsageSessions(filters)),
    usageKeys.sessions(filters, scope),
    "historical",
  );
}

export function usageSessionLogsQueryOptions(
  bff: DataFabricBffTransport,
  filters: UsageSessionLogsFilters,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageSessionLogsResponse>(
    bff,
    bffSource("GET /usage/sessions/logs", () => fetchUsageSessionLogs(filters)),
    usageKeys.sessionLogs(filters, scope),
    "historical",
  );
}

export function usageTimeseriesQueryOptions(
  bff: DataFabricBffTransport,
  filters: UsageTimeseriesFilters,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageTimeseriesResponse>(
    bff,
    bffSource("GET /usage/timeseries", () => fetchUsageTimeseries(filters)),
    usageKeys.timeseries(filters, scope),
    "historical",
  );
}

export function useUsageCostQuery(days = 14, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...usageCostQueryOptions(bff, days, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useUsageProvidersQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...usageProvidersQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useUsageSessionsQuery(
  filters: UsageSessionsFilters = {},
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...usageSessionsQueryOptions(bff, filters, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useUsageSessionLogsQuery(
  filters: UsageSessionLogsFilters | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeFilters = filters ?? { key: "" };
  return useQuery({
    ...usageSessionLogsQueryOptions(bff, safeFilters, options.scope),
    enabled: enabledNonEmpty(filters?.key, options.enabled ?? true),
  });
}

export function useUsageTimeseriesQuery(
  filters: UsageTimeseriesFilters | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeFilters = filters ?? { key: "" };
  return useQuery({
    ...usageTimeseriesQueryOptions(bff, safeFilters, options.scope),
    enabled: enabledNonEmpty(filters?.key, options.enabled ?? true),
  });
}
