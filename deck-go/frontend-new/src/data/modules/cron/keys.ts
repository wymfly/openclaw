import type { DeckGoCronJobsParams, DeckGoCronRunsParams } from "@/api-types";
import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

export type CronJobsFilters = DeckGoCronJobsParams;
export type CronRunsFilters = DeckGoCronRunsParams;

const moduleName = "cron";

export const cronKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  jobs: (filters: CronJobsFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.module.list(moduleName, filters, scope),
  status: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["status"], scope),
  runs: (jobId: string, filters: CronRunsFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["runs", jobId, filters], scope),
};
