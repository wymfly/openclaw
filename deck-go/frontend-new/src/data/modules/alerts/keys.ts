import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "alerts";

export const alertsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (scope?: DeckQueryScope) => deckKeys.module.list(moduleName, undefined, scope),
};
