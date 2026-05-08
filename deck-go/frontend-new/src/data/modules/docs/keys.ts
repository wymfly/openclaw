import type { DeckGoDocCategory } from "@/api-types";
import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

const moduleName = "docs";

export type DocsListFilters = {
  category?: DeckGoDocCategory | null;
  query?: string;
};

export const docsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.module.all(moduleName, scope),
  list: (filters?: DocsListFilters, scope?: DeckQueryScope) =>
    deckKeys.module.list(moduleName, filters ?? {}, scope),
  detail: (docId: string, scope?: DeckQueryScope) =>
    deckKeys.module.detail(moduleName, docId, scope),
};
