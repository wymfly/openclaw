import { useQuery } from "@tanstack/react-query";
import {
  fetchActivityEvents,
  fetchControlAuditEvents,
  fetchMonitorRunDetail,
  fetchMonitorRuns,
  fetchMonitorStats,
} from "@/api";
import type {
  DeckGoActivityResponse,
  DeckGoControlAuditEventsResponse,
  DeckGoMonitorRunDetailResponse,
  DeckGoMonitorRunsResponse,
  DeckGoMonitorStatsResponse,
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
import { activityKeys, type MonitorRunsFilters } from "./keys";

export function activityEventsQueryOptions(
  bff: DataFabricBffTransport,
  limit = 100,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoActivityResponse>(
    bff,
    bffSource("GET /activity", () => fetchActivityEvents(limit)),
    activityKeys.events(limit, scope),
    "historical",
  );
}

export function monitorRunsQueryOptions(
  bff: DataFabricBffTransport,
  filters: MonitorRunsFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoMonitorRunsResponse>(
    bff,
    bffSource("GET /monitor/runs", () => fetchMonitorRuns(filters)),
    activityKeys.monitorRuns(filters, scope),
    "live-workbench",
  );
}

export function monitorStatsQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoMonitorStatsResponse>(
    bff,
    bffSource("GET /monitor/stats", () => fetchMonitorStats()),
    activityKeys.monitorStats(scope),
    "historical",
  );
}

export function monitorRunDetailQueryOptions(
  bff: DataFabricBffTransport,
  runId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoMonitorRunDetailResponse>(
    bff,
    bffSource("GET /monitor/runs/{runId}", () => fetchMonitorRunDetail(runId)),
    activityKeys.monitorRunDetail(runId, scope),
    "lazy-detail",
  );
}

export function activityAuditEventsQueryOptions(
  bff: DataFabricBffTransport,
  limit = 100,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoControlAuditEventsResponse>(
    bff,
    bffSource("GET /audit/events", () => fetchControlAuditEvents(limit)),
    activityKeys.auditEvents(limit, scope),
    "historical",
  );
}

export function useActivityEventsQuery(limit = 100, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...activityEventsQueryOptions(bff, limit, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useMonitorRunsQuery(
  filters: MonitorRunsFilters = {},
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...monitorRunsQueryOptions(bff, filters, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useMonitorStatsQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...monitorStatsQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useMonitorRunDetailQuery(
  runId: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeRunId = runId ?? "";
  return useQuery({
    ...monitorRunDetailQueryOptions(bff, safeRunId, options.scope),
    enabled: enabledNonEmpty(runId, options.enabled ?? true),
  });
}

export function useActivityAuditEventsQuery(limit = 100, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...activityAuditEventsQueryOptions(bff, limit, options.scope),
    enabled: options.enabled ?? true,
  });
}
