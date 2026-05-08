import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { DeckGoServerEvent } from "@/api-types";
import {
  applyDataFabricLiveInvalidation,
  type DataFabricLiveInvalidationResult,
} from "../../live-invalidation";
import { agentsKeys } from "./keys";

const agentStatusEvents = new Set(["agent.status.changed", "activity.event"]);
const agentStatusGapPolicy = {
  endpointKeys: {
    "GET /deck/agents?agentId=...": [agentsKeys.all(), agentsKeys.health()] as QueryKey[],
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readAgentId(event: DeckGoServerEvent) {
  const json = asRecord(event.json);
  const agentId = typeof json?.agentId === "string" ? json.agentId.trim() : "";
  return agentId || null;
}

export function resolveAgentStatusInvalidation(event: DeckGoServerEvent) {
  const eventName = event.event ?? "";
  const agentId = readAgentId(event);
  const keys: QueryKey[] = [];

  if (agentStatusEvents.has(eventName)) {
    keys.push(agentsKeys.all(), agentsKeys.health());
    if (agentId) {
      keys.push(agentsKeys.detail(agentId));
    }
  }

  return {
    agentId,
    eventName,
    invalidatedKeys: keys,
    stale: eventName === "projection.gap",
  };
}

export async function applyAgentStatusInvalidation(
  queryClient: QueryClient,
  event: DeckGoServerEvent,
): Promise<DataFabricLiveInvalidationResult | { invalidatedKeys: QueryKey[]; stale: boolean }> {
  if (event.event === "projection.gap") {
    return applyDataFabricLiveInvalidation(
      queryClient,
      { event: "projection.gap", projectionId: "agent-status" },
      agentStatusGapPolicy,
    );
  }

  const result = resolveAgentStatusInvalidation(event);
  await Promise.all(
    result.invalidatedKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
  return result;
}
