import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "nodes";

export const nodesKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (scope?: DeckQueryScope) => deckKeys.module.list(moduleName, undefined, scope),
  pairing: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["pairing"], scope),
  detail: (nodeId: string, scope?: DeckQueryScope) =>
    deckKeys.module.detail(moduleName, nodeId, scope),
};
