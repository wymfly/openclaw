import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "approvals";

export const approvalsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  policy: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["policy"], scope),
  pending: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["pending"], scope),
  plugins: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["plugins"], scope),
};
