import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useAgentsStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";

export function AgentTabs() {
  const t = useTranslations("chat");
  const agents = useAgentsStore((state) => state.agents);
  const fetchAgents = useAgentsStore((state) => state.fetchAgents);
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const sessionMetas = useChatStore((state) => state.sessionMetas);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const agentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const meta of sessionMetas) {
      const agentId = meta.agentId || "main";
      counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
    }
    return counts;
  }, [sessionMetas]);

  return (
    <div className="deck-ui-agent-tabs" role="tablist">
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
    <button
      className={`deck-ui-agent-tab ${active ? "is-active" : ""}`}
      type="button"
      role="tab"
      aria-label={accessibleLabel}
      aria-selected={active}
      onClick={onSelect}
    >
      <span>{label}</span>
      {count > 0 ? <span>{count}</span> : null}
    </button>
  );
}
