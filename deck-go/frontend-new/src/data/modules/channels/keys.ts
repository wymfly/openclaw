import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "channels";

export const channelsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (scope?: DeckQueryScope) => deckKeys.module.list(moduleName, undefined, scope),
  throughput: (channelId: string, window = "1h", scope?: DeckQueryScope) =>
    deckKeys.module.item(moduleName, ["throughput", channelId, window], scope),
};
