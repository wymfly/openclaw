import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "subagents";

export type SubagentRunsFilters = {
  agentId?: string;
  limit?: number;
  offset?: number;
  requesterAgentId?: string;
  status?: string;
};

export type SubagentLineageParams = {
  runId?: string;
  sessionKey?: string;
};

export const subagentsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  runs: (filters: SubagentRunsFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.module.list(moduleName, filters, scope),
  lineage: (params: SubagentLineageParams, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["lineage", params], scope),
  lineageByRunId: (runId: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["lineage", { runId }], scope),
  lineageBySessionKey: (sessionKey: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["lineage", { sessionKey }], scope),
};
