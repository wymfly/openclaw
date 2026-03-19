"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0 flex-wrap">
        <h2 className="text-sm font-semibold shrink-0 text-[var(--text-primary)]">{t("title")}</h2>

        {/* Agent selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t("agent")}:</span>
          <Select
            value={selectedAgentId ?? "_none"}
            onValueChange={(val) => setSelectedAgent(val === "_none" ? null : val)}
          >
            <SelectTrigger className="w-[140px] h-7 text-xs" size="sm">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">--</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scope filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t("scope")}:</span>
          <Select
            value={selectedScope}
            onValueChange={(val) => setSelectedScope(val as MemoryScope)}
          >
            <SelectTrigger className="w-[100px] h-7 text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {t(SCOPE_LABEL_KEYS[scope])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 ml-auto rounded-lg bg-[var(--bg-tertiary)] p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                activeTab === tab
                  ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => setActiveTab(tab)}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </button>
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
