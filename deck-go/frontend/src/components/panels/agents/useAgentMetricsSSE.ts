import { useEffect, useRef, useState } from "react";
import { fetchAgentHealthSnapshot, streamEvents, type DeckGoServerEvent } from "../../../api";

export interface AgentMetrics {
  activeRuns: number;
  messageCount: number;
  lastUpdated: number;
}

const EMPTY_METRICS: AgentMetrics = {
  activeRuns: 0,
  messageCount: 0,
  lastUpdated: 0,
};

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStreamPayload(event: DeckGoServerEvent): Record<string, unknown> | null {
  const jsonPayload = readRecord(event.json);
  if (jsonPayload) {
    return jsonPayload;
  }
  if (!event.data) {
    return null;
  }
  try {
    return readRecord(JSON.parse(event.data));
  } catch {
    return null;
  }
}

function readSessionsCount(agent: Record<string, unknown>) {
  const sessions = readRecord(agent.sessions);
  const count = sessions?.count;
  return typeof count === "number" && Number.isFinite(count) ? Math.max(0, count) : undefined;
}

export function metricsFromHealthSnapshot(
  snapshot: unknown,
  agentId: string,
  now = Date.now(),
): AgentMetrics | null {
  const record = readRecord(snapshot);
  const agents = Array.isArray(record?.agents) ? record.agents : [];
  const match = agents.map(readRecord).find((agent) => {
    if (!agent) {
      return false;
    }
    return agent.agentId === agentId || agent.name === agentId;
  });
  if (!match) {
    return null;
  }
  return {
    ...EMPTY_METRICS,
    activeRuns: readSessionsCount(match) ?? 0,
    lastUpdated: now,
  };
}

export function reduceAgentMetricsEvent(
  current: AgentMetrics,
  agentId: string,
  event: DeckGoServerEvent,
  now = Date.now(),
): AgentMetrics {
  const payload = readStreamPayload(event);
  if (!payload || payload.agentId !== agentId) {
    return current;
  }

  if (event.event === "activity.event" && payload.type === "chat") {
    return {
      ...current,
      messageCount: current.messageCount + 1,
      lastUpdated: now,
    };
  }

  if (event.event === "agent.status.changed") {
    if (payload.status === "busy") {
      return {
        ...current,
        activeRuns: current.activeRuns + 1,
        lastUpdated: now,
      };
    }
    if (payload.status === "idle") {
      return {
        ...current,
        activeRuns: 0,
        lastUpdated: now,
      };
    }
  }

  return current;
}

export function useAgentMetricsSSE(agentId: string | null): AgentMetrics {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  useEffect(() => {
    setMetrics(EMPTY_METRICS);
    if (!agentId) {
      return undefined;
    }
    let cancelled = false;
    void fetchAgentHealthSnapshot()
      .then((snapshot) => {
        if (cancelled || agentIdRef.current !== agentId) {
          return;
        }
        const nextMetrics = metricsFromHealthSnapshot(snapshot, agentId);
        if (nextMetrics) {
          setMetrics(nextMetrics);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    if (!agentId) {
      return undefined;
    }
    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      retryDelayMs: 1_000,
      onEvent(event) {
        const currentAgentId = agentIdRef.current;
        if (!currentAgentId) {
          return;
        }
        setMetrics((current) => reduceAgentMetricsEvent(current, currentAgentId, event));
      },
    }).catch(() => {});

    return () => {
      controller.abort();
    };
  }, [agentId]);

  return metrics;
}
