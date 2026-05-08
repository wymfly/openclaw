import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "identity";

export const identityKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  links: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["links"], scope),
};
