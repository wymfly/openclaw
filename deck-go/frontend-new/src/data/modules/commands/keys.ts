import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "commands";

export const commandsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  discovery: (agentId?: string | null, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["discovery", { agentId: agentId ?? null }], scope),
};
