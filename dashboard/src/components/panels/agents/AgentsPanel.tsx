"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useAgentsStore } from "@/stores/agents";
import { AgentDetail } from "./AgentDetail";
import { AgentList } from "./AgentList";

/**
 * Agents panel — entry point component.
 * Composes agent list sidebar and detail view.
 */
export function AgentsPanel() {
  const t = useTranslations("agents");
  const { selectedAgentId, fetchAgents } = useAgentsStore();

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  return (
    <Card className="flex-row h-full p-0 gap-0">
      <AgentList />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedAgentId ? (
          <AgentDetail agentId={selectedAgentId} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">{t("selectAgent")}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
