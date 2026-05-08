import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

export type ThreadsFilters = {
  agentId?: string;
  channel?: string;
  status?: "active" | "all";
};

const moduleName = "threads";

export const threadsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (filters: ThreadsFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.module.list(moduleName, filters, scope),
};
