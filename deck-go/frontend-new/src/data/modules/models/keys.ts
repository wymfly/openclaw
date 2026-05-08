import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "models";

export const modelsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  config: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["config"], scope),
  configured: (scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["runtime", "configured"], scope),
  authOverview: (scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["runtime", "auth"], scope),
  catalogProviders: (scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["runtime", "catalog-providers"], scope),
  lookup: (path: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["lookup", path], scope),
  usageCost: (days?: number, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["usage", "cost", days ?? null], scope),
  usageProviders: (scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["usage", "providers"], scope),
};
