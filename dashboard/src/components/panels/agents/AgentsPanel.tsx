"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { useAgentsStore } from "@/stores/agents";
import { AgentDetail } from "./AgentDetail";
import { AgentList } from "./AgentList";

/**
 * Agents panel — entry point component.
 * Composes agent list sidebar and detail view.
 * On mobile, shows only one at a time (list or detail).
 */
export function AgentsPanel() {
  const t = useTranslations("agents");
  const { selectedAgentId, fetchAgents } = useAgentsStore();
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  // Mobile: show detail when agent selected, list otherwise
  if (isMobile && selectedAgentId) {
    return (
      <div
        className="flex flex-col h-full rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--border)" }}
      >
        <AgentDetail agentId={selectedAgentId} />
      </div>
    );
  }

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      <AgentList />
      {!isMobile && (
        <div className="flex flex-col flex-1 min-w-0">
          {selectedAgentId ? (
            <AgentDetail agentId={selectedAgentId} />
          ) : (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">{t("selectAgent")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
