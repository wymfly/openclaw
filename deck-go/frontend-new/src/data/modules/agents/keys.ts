import { deckKeys, type DeckQueryScope } from "../../contracts/query-keys";

function agentDetailRoot(agentId: string, scope?: DeckQueryScope) {
  return deckKeys.agents.detail(agentId, scope);
}

export const agentsKeys = {
  all: (scope?: DeckQueryScope) => deckKeys.agents.all(scope),
  list: (scope?: DeckQueryScope) => deckKeys.agents.list(undefined, scope),
  configuredModels: (scope?: DeckQueryScope) =>
    [...deckKeys.runtime.all(scope), "models", "configured"] as const,
  detail: (agentId: string, scope?: DeckQueryScope) => agentDetailRoot(agentId, scope),
  health: (scope?: DeckQueryScope) => [...deckKeys.agents.all(scope), "health"] as const,
  skills: (agentId: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "skills"] as const,
  subagents: (agentId: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "subagents"] as const,
  modelPolicy: (agentId?: string, scope?: DeckQueryScope) =>
    [...deckKeys.agents.all(scope), "model-policy", agentId ?? "global"] as const,
  eventStreams: (agentId: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "event-streams"] as const,
  toolPolicy: (agentId: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "tool-policy"] as const,
  systemPrompt: (agentId: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "system-prompt"] as const,
  files: (agentId: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "files"] as const,
  file: (agentId: string, name: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "files", name] as const,
  identity: (agentId: string, scope?: DeckQueryScope) =>
    [...agentDetailRoot(agentId, scope), "identity"] as const,
};
