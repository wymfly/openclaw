"use client";

import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useAgentsStore } from "@/stores/agents";
import { AgentDetail } from "./AgentDetail";
import { AgentList } from "./AgentList";

/**
 * Agents panel — master-detail layout.
 * Left sidebar lists agents with active indicator bar;
 * right pane shows selected agent config.
 */
export function AgentsPanel() {
  const t = useTranslations("agents");
  const { selectedAgentId, fetchAgents } = useAgentsStore();

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      <AgentList />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedAgentId ? (
          <AgentDetail agentId={selectedAgentId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
              <Bot size={20} className="text-[var(--accent)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("selectAgent")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
