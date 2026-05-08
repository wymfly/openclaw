import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "config";

export const configKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  snapshot: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["snapshot"], scope),
  lookup: (path: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["lookup", path], scope),
};
