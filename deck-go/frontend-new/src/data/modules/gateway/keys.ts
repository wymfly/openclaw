import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "gateway";

export const gatewayKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  health: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["health"], scope),
  status: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["status"], scope),
  describe: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["describe"], scope),
};
