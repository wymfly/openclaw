import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

export type UsageSessionsFilters = {
  endDate?: string;
  includeContextWeight?: boolean;
  key?: string;
  limit?: number;
  startDate?: string;
};

export type UsageSessionLogsFilters = {
  key: string;
  limit?: number;
};

export type UsageTimeseriesFilters = {
  endDate?: string;
  key: string;
  mode?: string;
  startDate?: string;
  utcOffset?: string;
};

export const usageKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.usage.all(scope),
  cost: (days = 14, scope?: DeckQueryScope) =>
    deckKeys.module.item("usage", ["cost", { days }], scope),
  providers: (scope?: DeckQueryScope) => deckKeys.module.item("usage", ["providers"], scope),
  sessions: (filters: UsageSessionsFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.usage.sessions(filters, scope),
  sessionLogs: (filters: UsageSessionLogsFilters, scope?: DeckQueryScope) =>
    deckKeys.module.item("usage", ["session-logs", filters], scope),
  timeseries: (filters: UsageTimeseriesFilters, scope?: DeckQueryScope) =>
    deckKeys.module.item("usage", ["timeseries", filters], scope),
};
