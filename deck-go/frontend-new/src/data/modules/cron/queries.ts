import { useQuery } from "@tanstack/react-query";
import { fetchCronJobs, fetchCronRuns, fetchCronStatus } from "@/api";
import type { DeckGoCronJobsResponse, DeckGoCronRunsResponse, DeckGoCronStatus } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { cronKeys, type CronJobsFilters, type CronRunsFilters } from "./keys";

export function cronJobsQueryOptions(
  bff: DataFabricBffTransport,
  filters: CronJobsFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoCronJobsResponse>(
    bff,
    bffSource("GET /cron", () => fetchCronJobs(filters)),
    cronKeys.jobs(filters, scope),
    "live-workbench",
  );
}

export function cronStatusQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoCronStatus>(
    bff,
    bffSource("GET /cron/status", () => fetchCronStatus()),
    cronKeys.status(scope),
    "live-workbench",
  );
}

export function cronRunsQueryOptions(
  bff: DataFabricBffTransport,
  jobId: string,
  filters: CronRunsFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoCronRunsResponse>(
    bff,
    bffSource("GET /cron/{jobId}/runs", () => fetchCronRuns(jobId, filters)),
    cronKeys.runs(jobId, filters, scope),
    "historical",
  );
}

export function useCronJobsQuery(filters: CronJobsFilters = {}, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...cronJobsQueryOptions(bff, filters, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useCronStatusQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...cronStatusQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useCronRunsQuery(
  jobId: string | null | undefined,
  filters: CronRunsFilters = {},
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeJobId = jobId ?? "";
  return useQuery({
    ...cronRunsQueryOptions(bff, safeJobId, filters, options.scope),
    enabled: enabledNonEmpty(jobId, options.enabled ?? true),
  });
}
