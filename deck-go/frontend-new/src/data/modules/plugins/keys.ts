import type { DeckGoPluginCapability } from "@/api-types";
import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "plugins";

export const pluginsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (capability: DeckGoPluginCapability = "channel", scope?: DeckQueryScope) =>
    deckKeys.module.list(moduleName, { capability }, scope),
};
