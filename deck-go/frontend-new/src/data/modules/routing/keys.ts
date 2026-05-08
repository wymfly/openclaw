import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "routing";

export type RoutingFilters = {
  accountId?: string;
  agentId?: string;
  channel?: string;
};

export const routingKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  bindings: (filters?: RoutingFilters, scope?: DeckQueryScope) =>
    deckKeys.module.list(moduleName, filters ?? {}, scope),
  activity: (limit: number, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["activity", limit], scope),
  validate: (params: unknown, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["validate", params], scope),
  simulate: (params: unknown, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["simulate", params], scope),
};
