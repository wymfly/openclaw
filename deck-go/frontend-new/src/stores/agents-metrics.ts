import type { DeckGoAgentStatus, DeckGoAgentSummary, DeckGoServerEvent } from "@/api-types";
import { parseServerEvent } from "@/stream-contract";

const KNOWN_STATUSES = new Set<DeckGoAgentStatus>(["idle", "busy", "error", "offline"]);
type AgentMetricSummary = Partial<DeckGoAgentSummary> & {
  id: string;
  status?: DeckGoAgentStatus;
};

export type AgentMetricsAction =
  | { kind: "none" }
  | { kind: "removed"; agentId: string }
  | { kind: "session-count"; agentId: string; sessionCount: number; atMs?: number }
  | { kind: "status"; agentId: string; status: DeckGoAgentStatus; atMs?: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function normalizeAgentStatus(value: unknown): DeckGoAgentStatus {
  return KNOWN_STATUSES.has(value as DeckGoAgentStatus) ? (value as DeckGoAgentStatus) : "idle";
}

export function readAgentMetricsAction(event: DeckGoServerEvent): AgentMetricsAction {
  const parsed = parseServerEvent(event);
  if (parsed.kind === "agent.status.changed") {
    const agentId = parsed.payload.agentId.trim();
    if (!agentId) {
      return { kind: "none" };
    }
    return {
      kind: "status",
      agentId,
      status: normalizeAgentStatus(parsed.payload.status),
    };
  }

  if (parsed.kind !== "activity.event") {
    return { kind: "none" };
  }

  const payload = asRecord(parsed.payload);
  const agentId = typeof payload?.agentId === "string" ? payload.agentId.trim() : "";
  if (!agentId) {
    return { kind: "none" };
  }

  const rawType = typeof payload?.type === "string" ? payload.type : "";
  const rawStatus = payload?.status;
  const rawCount = payload?.sessionCount;
  const atMs = typeof payload?.tsMs === "number" ? payload.tsMs : undefined;

  if (rawType === "agent.removed" || rawType === "removed") {
    return { kind: "removed", agentId };
  }
  if (
    rawType === "agent.session-count" &&
    typeof rawCount === "number" &&
    Number.isFinite(rawCount)
  ) {
    return { kind: "session-count", agentId, sessionCount: rawCount, atMs };
  }
  if (rawType === "agent.status" || rawType === "status") {
    return { kind: "status", agentId, status: normalizeAgentStatus(rawStatus), atMs };
  }

  return { kind: "none" };
}

export function reduceAgentMetricsEvent<TAgent extends AgentMetricSummary>(
  agents: TAgent[],
  event: DeckGoServerEvent,
): TAgent[] {
  const action = readAgentMetricsAction(event);
  switch (action.kind) {
    case "removed":
      return agents.filter((agent) => agent.id !== action.agentId);
    case "session-count":
      return agents.map((agent) =>
        agent.id === action.agentId
          ? ({ ...agent, sessionCount: action.sessionCount, lastActiveAtMs: action.atMs } as TAgent)
          : agent,
      );
    case "status":
      return agents.map((agent) =>
        agent.id === action.agentId
          ? ({
              ...agent,
              status: action.status,
              lastActiveAtMs: action.atMs ?? Date.now(),
            } as TAgent)
          : agent,
      );
    case "none":
      return agents;
  }
  return agents;
}
