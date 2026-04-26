import { createLocalStore } from "./create-local-store";

export interface Agent {
  id: string;
  name: string;
  model: string;
  status: "idle" | "busy" | "error" | "offline";
}

interface AgentsState {
  agents: Agent[];
  fetchAgents: () => Promise<void>;
}

export const useAgentsStore = createLocalStore<AgentsState>(() => ({
  agents: [],
  async fetchAgents() {},
}));
