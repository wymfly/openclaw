import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

export type SessionsListFilters = {
  activeMinutes?: number;
  agentId?: string;
  limit?: number;
  search?: string;
};

export type SessionDetailFilters = {
  agentId?: string;
  limit?: number;
  sessionKey: string;
};

export const sessionsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.sessions.all(scope),
  list: (filters: SessionsListFilters = {}, scope?: DeckQueryScope) =>
    deckKeys.sessions.list(filters, scope),
  previews: (keys: readonly string[], scope?: DeckQueryScope) =>
    deckKeys.module.item("sessions", ["previews", [...keys].toSorted()], scope),
  detail: (sessionKey: string, scope?: DeckQueryScope) =>
    deckKeys.sessions.detail(sessionKey, scope),
  detailWithFilters: (filters: SessionDetailFilters, scope?: DeckQueryScope) =>
    deckKeys.module.item("sessions", ["detail", filters], scope),
  history: (sessionKey: string, limit = 80, scope?: DeckQueryScope) =>
    deckKeys.module.item("sessions", ["history", { limit, sessionKey }], scope),
  usage: (sessionKey: string, scope?: DeckQueryScope) =>
    deckKeys.module.item("sessions", ["usage", sessionKey], scope),
  usageLogs: (sessionKey: string, limit = 100, scope?: DeckQueryScope) =>
    deckKeys.module.item("sessions", ["usage-logs", { limit, sessionKey }], scope),
  lineage: (sessionKey: string, scope?: DeckQueryScope) =>
    deckKeys.module.item("sessions", ["lineage", sessionKey], scope),
  compactionCheckpoints: (sessionKey: string, scope?: DeckQueryScope) =>
    deckKeys.module.item("sessions", ["compaction", "checkpoints", sessionKey], scope),
};
