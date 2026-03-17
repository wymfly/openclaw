"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMemoryStore, type MemoryTab } from "@/stores/memory";
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

/**
 * Memory Browser panel — top agent selector + tab bar, and active tab content.
 */
export function MemoryPanel() {
  const t = useTranslations("memory");
  const {
    agents,
    selectedAgentId,
    activeTab,
    fetchAgents,
    setSelectedAgent,
    setActiveTab,
    browseFiles,
    fetchHealth,
  } = useMemoryStore();

  // Fetch agents on mount.
  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  // When agent changes, browse root files.
  useEffect(() => {
    if (selectedAgentId) {
      void browseFiles(selectedAgentId);
    }
  }, [selectedAgentId, browseFiles]);

  // When health tab is active, fetch health data.
  useEffect(() => {
    if (activeTab === "health") {
      void fetchHealth();
    }
  }, [activeTab, fetchHealth]);

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-wrap"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <h2 className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h2>

        {/* Agent selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("agent")}:
          </span>
          <select
            value={selectedAgentId ?? ""}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
            className="text-xs rounded px-2 py-1 border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              minWidth: 120,
            }}
          >
            <option value="">--</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 ml-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="text-xs px-3 py-1 rounded border cursor-pointer"
              style={{
                borderColor: activeTab === tab ? "var(--accent)" : "var(--border)",
                backgroundColor:
                  activeTab === tab
                    ? "var(--accent-muted, rgba(59,130,246,0.1))"
                    : "var(--bg-primary)",
                color: activeTab === tab ? "var(--accent)" : "var(--text-primary)",
              }}
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
