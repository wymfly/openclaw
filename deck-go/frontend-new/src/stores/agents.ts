import { fetchAgentsList } from "@/api";
import type {
  DeckGoAgentStatus,
  DeckGoAgentSummary,
  DeckGoAgentsListResponse,
  DeckGoServerEvent,
} from "@/api-types";
import { normalizeAgentStatus, reduceAgentMetricsEvent } from "./agents-metrics";
import { createLocalStore } from "./create-local-store";

export type AgentsLoadStatus = "idle" | "loading" | "ready" | "error";
export type AgentsListFetcher = () => Promise<DeckGoAgentsListResponse>;
export type Agent = Omit<DeckGoAgentSummary, "isDefault"> & { isDefault?: boolean };

export interface AgentsState {
  agents: Agent[];
  selectedAgentId: string | null;
  status: AgentsLoadStatus;
  error: string | null;
  loadedAtMs: number | null;
  loadAgents: (fetcher?: AgentsListFetcher) => Promise<void>;
  fetchAgents: (fetcher?: AgentsListFetcher) => Promise<void>;
  refreshAgents: (fetcher?: AgentsListFetcher) => Promise<void>;
  selectAgent: (agentId: string | null) => void;
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  updateAgentStatus: (agentId: string, status: DeckGoAgentStatus, lastActiveAtMs?: number) => void;
  applyServerEvent: (event: DeckGoServerEvent) => void;
  reset: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error || "agents load failed";
  }
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return String(error);
  }
  return "agents load failed";
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
  return {
    ...agent,
    id,
    name: agent.name?.trim() || id,
    isDefault: Boolean(agent.isDefault),
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

function initialState(): Pick<
  AgentsState,
  "agents" | "selectedAgentId" | "status" | "error" | "loadedAtMs"
> {
  return {
    agents: [],
    selectedAgentId: null,
    status: "idle",
    error: null,
    loadedAtMs: null,
  };
}

export const useAgentsStore = createLocalStore<AgentsState>((set, get) => ({
  ...initialState(),
  async loadAgents(fetcher = fetchAgentsList) {
    set({ status: "loading", error: null });
    try {
      const response = await fetcher();
      const agents = response.agents.map(normalizeAgentSummary);
      set({
        agents,
        selectedAgentId: preserveSelection(agents, get().selectedAgentId),
        status: "ready",
        error: null,
        loadedAtMs: Date.now(),
      });
    } catch (error) {
      set({ status: "error", error: errorMessage(error) });
    }
  },
  async fetchAgents(fetcher = fetchAgentsList) {
    await get().loadAgents(fetcher);
  },
  async refreshAgents(fetcher = fetchAgentsList) {
    await get().loadAgents(fetcher);
  },
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
      status: "ready",
      error: null,
      loadedAtMs: Date.now(),
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
    set({ agents, selectedAgentId: nextSelection(agents, get().selectedAgentId) });
  },
  reset() {
    set(initialState());
  },
}));
