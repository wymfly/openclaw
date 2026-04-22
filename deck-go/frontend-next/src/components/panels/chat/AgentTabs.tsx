"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useAgentsStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";

/**
 * Agent tab bar for quick filtering of sessions by agent.
 * Replaces the native <select> with a horizontal tab strip.
 */
export function AgentTabs() {
  const t = useTranslations("chat");
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);
  const sessionMetas = useChatStore((s) => s.sessionMetas);

  const agentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const meta of sessionMetas) {
      const id = meta.agentId || "main";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [sessionMetas]);

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 border-b overflow-x-auto"
      style={{ borderColor: "var(--border)" }}
      role="tablist"
    >
      <TabItem
        label={t("allAgents")}
        count={sessionMetas.length}
        active={activeAgentId === null}
        onClick={() => setActiveAgent(null)}
      />
      {agents.map((agent) => (
        <TabItem
          key={agent.id}
          label={agent.name || agent.id}
          count={agentCounts.get(agent.id) ?? 0}
          active={activeAgentId === agent.id}
          onClick={() => setActiveAgent(agent.id)}
        />
      ))}
    </div>
  );
}

function TabItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors"
      style={{
        backgroundColor: active ? "var(--primary-muted)" : "transparent",
        color: active ? "var(--primary)" : "var(--muted-foreground)",
      }}
    >
      <span className="truncate max-w-[80px]">{label}</span>
      {count > 0 && (
        <span
          className="text-[10px] px-1 rounded-full"
          style={{
            backgroundColor: active ? "var(--primary)" : "var(--muted)",
            color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
