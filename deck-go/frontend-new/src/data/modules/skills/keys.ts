import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "skills";

export const skillsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (filters?: unknown, scope?: DeckQueryScope) =>
    deckKeys.module.list(moduleName, filters, scope),
  approvals: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["approvals"], scope),
  hubBins: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["hub", "bins"], scope),
  hubSearch: (query: string, limit = 20, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["hub", "search", { limit, query }], scope),
  hubDetail: (slug: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["hub", "detail", slug], scope),
};
