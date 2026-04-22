"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { deckFetch, deckStream } from "@/lib/deck-client";

// ---------------------------------------------------------------------------
// Store — lightweight, agent-scoped metrics updated via SSE
// ---------------------------------------------------------------------------

interface AgentMetrics {
  activeRuns: number;
  messageCount: number;
  lastUpdated: number;
}

interface AgentMetricsState {
  metrics: Map<string, AgentMetrics>;
  update: (agentId: string, patch: Partial<AgentMetrics>) => void;
  incrementRuns: (agentId: string, delta: number) => void;
  incrementMessages: (agentId: string) => void;
}

export const useAgentMetricsStore = create<AgentMetricsState>((set) => ({
  metrics: new Map(),
  update: (agentId, patch) =>
    set((state) => {
      const next = new Map(state.metrics);
      const prev = next.get(agentId) ?? { activeRuns: 0, messageCount: 0, lastUpdated: 0 };
      next.set(agentId, { ...prev, ...patch, lastUpdated: Date.now() });
      return { metrics: next };
    }),
  incrementRuns: (agentId, delta) =>
    set((state) => {
      const next = new Map(state.metrics);
      const prev = next.get(agentId) ?? { activeRuns: 0, messageCount: 0, lastUpdated: 0 };
      next.set(agentId, {
        ...prev,
        activeRuns: Math.max(0, prev.activeRuns + delta),
        lastUpdated: Date.now(),
      });
      return { metrics: next };
    }),
  incrementMessages: (agentId) =>
    set((state) => {
      const next = new Map(state.metrics);
      const prev = next.get(agentId) ?? { activeRuns: 0, messageCount: 0, lastUpdated: 0 };
      next.set(agentId, { ...prev, messageCount: prev.messageCount + 1, lastUpdated: Date.now() });
      return { metrics: next };
    }),
}));

// ---------------------------------------------------------------------------
// SSE Hook — listens for activity.event + agent.status.changed
// ---------------------------------------------------------------------------

export function useAgentMetricsSSE(agentId: string | null) {
  const { incrementRuns, incrementMessages, update } = useAgentMetricsStore();
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  // Bootstrap initial metrics from current agent status (avoids zero-flash)
  useEffect(() => {
    if (!agentId) {
      return;
    }
    void deckFetch("/api/deck/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "health" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !agentIdRef.current) {
          return;
        }
        const agents = Array.isArray(data.agents) ? (data.agents as Record<string, unknown>[]) : [];
        const match = agents.find(
          (a) => a.agentId === agentIdRef.current || a.name === agentIdRef.current,
        );
        if (match) {
          const sessions = match.sessions as { count?: number } | undefined;
          const activeRuns = sessions?.count ?? 0;
          update(agentIdRef.current, { activeRuns });
        }
      })
      .catch(() => {});
  }, [agentId, update]);

  useEffect(() => {
    if (!agentId) {
      return;
    }

    const controller = new AbortController();
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        if (!event.data) {
          return;
        }
        const currentId = agentIdRef.current;
        if (!currentId) {
          return;
        }

        try {
          if (event.event === "activity.event") {
            const payload = JSON.parse(event.data) as {
              type?: string;
              agentId?: string;
              description?: string;
            };
            if (payload.agentId !== currentId) {
              return;
            }

            if (payload.type === "chat") {
              incrementMessages(currentId);
            }
          } else if (event.event === "agent.status.changed") {
            const payload = JSON.parse(event.data) as {
              agentId?: string;
              status?: string;
            };
            if (payload.agentId !== currentId) {
              return;
            }

            if (payload.status === "busy") {
              incrementRuns(currentId, 1);
            } else if (payload.status === "idle") {
              // Agent went idle — reset active runs to 0
              update(currentId, { activeRuns: 0 });
            }
          }
        } catch {
          // Ignore malformed payloads
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [agentId, incrementRuns, incrementMessages, update]);
}
