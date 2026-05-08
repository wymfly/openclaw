import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "chat";

export type ChatSnapshotFilters = {
  agentId?: string;
  limit?: number;
  sessionKey: string;
};

export const chatKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  snapshot: (filters: ChatSnapshotFilters, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["snapshot", filters], scope),
  sessionEvents: (sessionKey: string, scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["session-events", sessionKey], scope),
};
