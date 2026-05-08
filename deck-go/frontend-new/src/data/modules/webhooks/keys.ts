import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "webhooks";

export const webhooksKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (scope?: DeckQueryScope) => deckKeys.module.list(moduleName, undefined, scope),
  deliveries: (webhookId: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["deliveries", webhookId], scope),
  testResult: (webhookId: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["test", webhookId], scope),
};
