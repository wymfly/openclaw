import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "settings";

export const settingsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  settings: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["settings"], scope),
  endpoint: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["endpoint"], scope),
  version: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["version"], scope),
  devices: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["devices"], scope),
  selfDevice: (scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["devices", "self"], scope),
};
