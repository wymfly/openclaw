import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "activity";

export type MonitorRunsFilters = {
  agentId?: string;
  cursor?: string;
  limit?: number;
  sessionKey?: string;
  since?: string;
  status?: string;
  until?: string;
};

export const activityKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  events: (limit = 100, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["events", { limit }], scope),
  monitorRuns: (filters: MonitorRunsFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["monitor-runs", filters], scope),
  monitorStats: (scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["monitor-stats"], scope),
  monitorRunDetail: (runId: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["monitor-runs", runId], scope),
  auditEvents: (limit = 100, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["audit-events", { limit }], scope),
};
