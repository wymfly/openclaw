import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

export type LogsTailFilters = {
  cursor?: number;
  limit?: number;
  maxBytes?: number;
};

const moduleName = "logs";

export const logsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  tail: (filters: LogsTailFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["tail", filters], scope),
};
