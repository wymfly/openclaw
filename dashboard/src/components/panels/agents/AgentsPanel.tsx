"use client";

import { useEffect } from "react";
import { useAgentsStore } from "@/stores/agents";
import { AgentDetail } from "./AgentDetail";
import { AgentList } from "./AgentList";

/**
 * Agents panel — entry point component.
 * Composes agent list sidebar and detail view.
 */
export function AgentsPanel() {
  const { selectedAgentId, fetchAgents } = useAgentsStore();

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      <AgentList />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedAgentId ? (
          <AgentDetail agentId={selectedAgentId} />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">Select an agent to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
