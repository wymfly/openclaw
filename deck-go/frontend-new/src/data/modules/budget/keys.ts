import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "budget";

export const budgetKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  rules: (scope?: DeckQueryScope) => deckKeys.module.list(moduleName, "rules", scope),
  evaluations: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["evaluations"], scope),
};
