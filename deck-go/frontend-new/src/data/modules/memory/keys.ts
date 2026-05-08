import type { DeckGoMemorySearchScope } from "@/api-types";
import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "memory";

export const memoryKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  browse: (agentId: string, path?: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["browse", agentId, path ?? ""], scope),
  file: (agentId: string, path: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["file", agentId, path], scope),
  health: (scope?: DeckQueryScope) => deckKeys.module.item(moduleName, ["health"], scope),
  search: (
    params: { agentId?: string; query: string; scope?: DeckGoMemorySearchScope },
    deckScope?: DeckQueryScope,
  ) => deckKeys.module.item(moduleName, ["search", params], deckScope),
};
