import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useAgentsListQuery } from "@/data/modules/agents";
import { Tab } from "@/design-system/atoms/Tab";
import { normalizeAgentSummary, useAgentsStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";

export function AgentTabs() {
  const t = useTranslations("chat");
  const agentsQuery = useAgentsListQuery();
  const localAgentOverlay = useAgentsStore((state) => state.agents);
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const sessionMetas = useChatStore((state) => state.sessionMetas);
  const agents = useMemo(
    () =>
      agentsQuery.data ? agentsQuery.data.agents.map(normalizeAgentSummary) : localAgentOverlay,
    [agentsQuery.data, localAgentOverlay],
  );

  const agentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const meta of sessionMetas) {
      const agentId = meta.agentId || "main";
      counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
    }
    return counts;
  }, [sessionMetas]);

  return (
    <div className="ds-agent-tabs deck-ui-agent-tabs" role="tablist">
      <AgentTab
        label={t("allAgents")}
        count={sessionMetas.length}
        active={activeAgentId === null}
        onSelect={() => setActiveAgent(null)}
      />
      {agents.map((agent) => (
        <AgentTab
          key={agent.id}
          label={agent.name || agent.id}
          count={agentCounts.get(agent.id) ?? 0}
          active={activeAgentId === agent.id}
          onSelect={() => setActiveAgent(agent.id)}
        />
      ))}
    </div>
  );
}

function AgentTab({
  active,
  count,
  label,
  onSelect,
}: {
  active: boolean;
  count: number;
  label: string;
  onSelect: () => void;
}) {
  const accessibleLabel = count > 0 ? `${label} ${count}` : label;
  return (
    <Tab
      active={active}
      className="deck-ui-agent-tab"
      aria-label={accessibleLabel}
      onClick={onSelect}
    >
      <span>{label}</span>
      {count > 0 ? <span>{count}</span> : null}
    </Tab>
  );
}
