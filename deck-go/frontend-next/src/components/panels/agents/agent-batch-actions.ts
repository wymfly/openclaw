import type { Agent } from "@/stores/agents";

export interface AgentBatchSummary {
  total: number;
  byStatus: Partial<Record<Agent["status"], number>>;
  byModel: Record<string, number>;
}

export function buildAgentBatchExportText(agents: Agent[]): string {
  const rows = agents.map(
    (agent) => `${agent.name} | ${agent.id} | ${agent.model || "-"} | ${agent.status}`,
  );
  return ["name | id | model | status", ...rows].join("\n");
}

export function summarizeAgents(agents: Agent[]): AgentBatchSummary {
  return agents.reduce<AgentBatchSummary>(
    (acc, agent) => {
      acc.total += 1;
      acc.byStatus[agent.status] = (acc.byStatus[agent.status] ?? 0) + 1;
      const modelKey = agent.model || "unassigned";
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
