export interface AgentBatchEntry {
  id: string;
  name?: string;
  model?: string;
  status?: unknown;
}

export interface AgentBatchSummary {
  total: number;
  byStatus: Record<string, number>;
  byModel: Record<string, number>;
}

function readAgentName(agent: AgentBatchEntry) {
  return agent.name?.trim() || agent.id;
}

function readAgentModel(agent: AgentBatchEntry, fallback: string) {
  return agent.model?.trim() || fallback;
}

function readAgentStatus(agent: AgentBatchEntry) {
  return typeof agent.status === "string" && agent.status.trim() ? agent.status.trim() : "unknown";
}

export function buildAgentBatchExportText(agents: AgentBatchEntry[]): string {
  const rows = agents.map(
    (agent) =>
      `${readAgentName(agent)} | ${agent.id} | ${readAgentModel(agent, "-")} | ${readAgentStatus(agent)}`,
  );
  return ["name | id | model | status", ...rows].join("\n");
}

export function summarizeAgents(agents: AgentBatchEntry[]): AgentBatchSummary {
  return agents.reduce(
    (acc, agent) => {
      acc.total += 1;
      const statusKey = readAgentStatus(agent);
      acc.byStatus[statusKey] = (acc.byStatus[statusKey] ?? 0) + 1;
      const modelKey = readAgentModel(agent, "unassigned");
      acc.byModel[modelKey] = (acc.byModel[modelKey] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      byStatus: {},
      byModel: {},
    },
  );
}
