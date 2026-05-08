import type { DeckGoAgentStatus, DeckGoAgentSummary, DeckGoServerEvent } from "@/api-types";
import { normalizeAgentStatus, reduceAgentMetricsEvent } from "./agents-metrics";
import { createLocalStore } from "./create-local-store";

export type Agent = Omit<Partial<DeckGoAgentSummary>, "id" | "name" | "status" | "isDefault"> & {
  id: string;
  name: string;
  status: DeckGoAgentStatus;
  isDefault?: boolean;
};

export interface AgentsState {
  agents: Agent[];
  selectedAgentId: string | null;
  selectAgent: (agentId: string | null) => void;
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  updateAgentStatus: (agentId: string, status: DeckGoAgentStatus, lastActiveAtMs?: number) => void;
  applyServerEvent: (event: DeckGoServerEvent) => void;
  reset: () => void;
}

function nextSelection(agents: Agent[], current: string | null): string | null {
  if (current && agents.some((agent) => agent.id === current)) {
    return current;
  }
  return agents.find((agent) => agent.isDefault)?.id ?? agents[0]?.id ?? null;
}

function preserveSelection(agents: Agent[], current: string | null): string | null {
  return current && agents.some((agent) => agent.id === current) ? current : null;
}

export function normalizeAgentSummary(agent: Agent): Agent {
  const id = agent.id.trim();
  const isDefault = Boolean(agent.isDefault);
  const isMainProtected = agent.isMainProtected ?? id === "main";
  return {
    ...agent,
    id,
    name: agent.name?.trim() || id,
    isDefault,
    isConfiguredDefault: agent.isConfiguredDefault ?? isDefault,
    isMainProtected,
    protectedReasons:
      agent.protectedReasons ??
      (isMainProtected
        ? ["main is the protected system/fallback agent and cannot be deleted"]
        : undefined),
    availableActions: agent.availableActions ?? {
      canEditIdentity: true,
      canEditRuntime: true,
      canDelete: !isMainProtected,
      canChangeDefault: false,
      deleteDisabledReason: isMainProtected
        ? "main is the protected system/fallback agent"
        : undefined,
    },
    impact: agent.impact ?? { deleteRemovesFiles: false },
    status: normalizeAgentStatus(agent.status),
    ...(typeof agent.sessionCount === "number" && Number.isFinite(agent.sessionCount)
      ? { sessionCount: agent.sessionCount }
      : {}),
    ...(typeof agent.bindingCount === "number" && Number.isFinite(agent.bindingCount)
      ? { bindingCount: agent.bindingCount }
      : {}),
    ...(typeof agent.lastActiveAtMs === "number" && Number.isFinite(agent.lastActiveAtMs)
      ? { lastActiveAtMs: agent.lastActiveAtMs }
      : {}),
  };
}

function initialState(): Pick<AgentsState, "agents" | "selectedAgentId"> {
  return {
    agents: [],
    selectedAgentId: null,
  };
}

export const useAgentsStore = createLocalStore<AgentsState>((set, get) => ({
  ...initialState(),
  selectAgent(agentId) {
    if (agentId && !get().agents.some((agent) => agent.id === agentId)) {
      set({ selectedAgentId: agentId });
      return;
    }
    set({ selectedAgentId: agentId });
  },
  setAgents(agents) {
    const normalized = agents.map(normalizeAgentSummary);
    set({
      agents: normalized,
      selectedAgentId: preserveSelection(normalized, get().selectedAgentId),
    });
  },
  upsertAgent(agent) {
    const normalized = normalizeAgentSummary(agent);
    const agents = [...get().agents];
    const index = agents.findIndex((entry) => entry.id === normalized.id);
    if (index >= 0) {
      agents[index] = { ...agents[index], ...normalized };
    } else {
      agents.unshift(normalized);
    }
    set({ agents, selectedAgentId: preserveSelection(agents, get().selectedAgentId) });
  },
  removeAgent(agentId) {
    const agents = get().agents.filter((agent) => agent.id !== agentId);
    set({ agents, selectedAgentId: nextSelection(agents, get().selectedAgentId) });
  },
  updateAgentStatus(agentId, status, lastActiveAtMs = Date.now()) {
    const agents = get().agents.map((agent) =>
      agent.id === agentId ? { ...agent, status, lastActiveAtMs } : agent,
    );
    set({ agents });
  },
  applyServerEvent(event) {
    const agents = reduceAgentMetricsEvent(get().agents, event);
    set({ agents, selectedAgentId: preserveSelection(agents, get().selectedAgentId) });
  },
  reset() {
    set(initialState());
  },
}));
