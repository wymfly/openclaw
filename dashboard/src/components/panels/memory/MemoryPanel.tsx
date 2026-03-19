"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMemoryStore, type MemoryTab, type MemoryScope } from "@/stores/memory";
import { FileTree } from "./FileTree";
import { HealthDiagnostics } from "./HealthDiagnostics";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { SearchPanel } from "./SearchPanel";

const TABS: MemoryTab[] = ["files", "search", "graph", "health"];

const TAB_LABEL_KEYS: Record<MemoryTab, string> = {
  files: "fileTree",
  search: "search",
  graph: "graph",
  health: "health",
};

export function MemoryPanel() {
  const t = useTranslations("memory");
  const SCOPES: MemoryScope[] = ["all", "global", "agent"];

  const SCOPE_LABEL_KEYS: Record<MemoryScope, string> = {
    all: "scope",
    global: "scopeGlobal",
    agent: "scopeAgent",
  };

  const {
    agents,
    selectedAgentId,
    selectedScope,
    activeTab,
    fetchAgents,
    setSelectedAgent,
    setSelectedScope,
    setActiveTab,
    browseFiles,
    fetchHealth,
  } = useMemoryStore();

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (selectedAgentId) {
      void browseFiles(selectedAgentId);
    }
  }, [selectedAgentId, browseFiles]);

  useEffect(() => {
    if (activeTab === "health") {
      void fetchHealth();
    }
  }, [activeTab, fetchHealth]);

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-wrap">
        <h2 className="text-sm font-semibold shrink-0 text-foreground">{t("title")}</h2>

        {/* Agent selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("agent")}:</span>
          <select
            value={selectedAgentId ?? ""}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
            className="text-xs rounded-lg px-2 py-1 border border-input bg-transparent text-foreground min-w-[120px]"
          >
            <option value="">--</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scope filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("scope")}:</span>
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value as MemoryScope)}
            className="text-xs rounded-lg px-2 py-1 border border-input bg-transparent text-foreground min-w-[90px]"
          >
            {SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {t(SCOPE_LABEL_KEYS[scope])}
              </option>
            ))}
          </select>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 ml-auto">
          {TABS.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="xs"
              onClick={() => setActiveTab(tab)}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "files" && <FileTree />}
        {activeTab === "search" && <SearchPanel />}
        {activeTab === "graph" && <KnowledgeGraph />}
        {activeTab === "health" && <HealthDiagnostics />}
      </div>
    </div>
  );
}
