"use client";

import { ArrowLeft, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { useAgentsStore } from "@/stores/agents";
import { useDeckAgentsStore } from "@/stores/deck-agents";
import { ContextTab } from "./tabs/ContextTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { RoutingTab } from "./tabs/RoutingTab";
import { SessionsTab } from "./tabs/SessionsTab";
import { SkillsTab } from "./tabs/SkillsTab";
import { SubagentTab } from "./tabs/SubagentTab";

const STATUS_BADGE: Record<string, string> = {
  idle: "bg-[var(--success-muted)] text-[var(--success-muted-text)]",
  busy: "bg-[var(--primary-muted)] text-[var(--primary)]",
  error: "bg-[var(--destructive-muted)] text-[var(--destructive-muted-text)]",
  offline: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

type TabValue = "overview" | "routing" | "skills" | "context" | "subagent" | "sessions";

export function AgentDetail({ agentId }: { agentId: string }) {
  const t = useTranslations("agentDetail");
  const ta = useTranslations("agents");
  const { currentDetail, loading, fetchDetail } = useDeckAgentsStore();
  const pendingTab = useAgentsStore((s) => s.pendingTab);
  const setPendingTab = useAgentsStore((s) => s.setPendingTab);
  const selectAgent = useAgentsStore((s) => s.selectAgent);
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const [activeTab, setActiveTab] = useState<TabValue>("overview");

  useEffect(() => {
    void fetchDetail(agentId);
  }, [agentId, fetchDetail]);

  // Reset to overview when switching agents, or to pending tab if set
  useEffect(() => {
    if (pendingTab) {
      setActiveTab(pendingTab as TabValue);
      setPendingTab(null);
    } else {
      setActiveTab("overview");
    }
  }, [agentId, pendingTab, setPendingTab]);

  if (loading && !currentDetail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-[var(--muted-foreground)]">Loading...</span>
      </div>
    );
  }

  const detail = currentDetail?.id === agentId ? currentDetail : null;

  if (!detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
          <Bot size={20} className="text-[var(--primary)]" />
        </div>
        <p className="text-sm">{ta("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)] shrink-0">
        {isMobile && (
          <button
            onClick={() => selectAgent(null)}
            className="p-1 -ml-1 rounded hover:bg-[var(--muted)] transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="text-[var(--muted-foreground)]" />
          </button>
        )}
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--primary-muted)] ring-1 ring-[var(--primary)]/20">
          {detail.emoji ? (
            <span className="text-base leading-none">{detail.emoji}</span>
          ) : (
            <Bot size={16} className="text-[var(--primary)]" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-semibold text-[var(--foreground)] tracking-tight">
            {detail.name}
          </h2>
          <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{detail.id}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {detail.isDefault && (
            <Badge className="text-[10px] border-0 bg-[var(--primary-muted)] text-[var(--primary)]">
              {t("defaultAgent")}
            </Badge>
          )}
          <Badge className={`text-[10px] border-0 ${STATUS_BADGE.idle}`}>{ta("idle")}</Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-4 pt-2 shrink-0 border-b border-[var(--border-subtle)]">
          <TabsList variant="line">
            <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
            <TabsTrigger value="routing">{t("routing")}</TabsTrigger>
            <TabsTrigger value="skills">{t("skills")}</TabsTrigger>
            <TabsTrigger value="context">{t("context")}</TabsTrigger>
            <TabsTrigger value="subagent">{t("subagent")}</TabsTrigger>
            <TabsTrigger value="sessions">{t("sessions")}</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <TabsContent value="overview" className="p-4">
            <OverviewTab detail={detail} onNavigateTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="routing" className="p-4">
            <RoutingTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="skills" className="p-4">
            <SkillsTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="context" className="p-4">
            <ContextTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="subagent" className="p-4">
            <SubagentTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="sessions" className="p-4">
            <SessionsTab agentId={agentId} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
