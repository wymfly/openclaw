"use client";

import { Bot, PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAgentsStore } from "@/stores/agents";
import { AgentDetail } from "./AgentDetail";
import { AgentList } from "./AgentList";

/**
 * Agents panel — responsive Master-Detail layout.
 * Desktop: 240px sidebar + detail pane.
 * Compact (<1024px): sidebar collapses to Sheet overlay.
 */
export function AgentsPanel() {
  const t = useTranslations("agents");
  const { selectedAgentId, fetchAgents } = useAgentsStore();
  const isCompact = useMediaQuery("(max-width: 1023px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Desktop: inline sidebar */}
      {!isCompact && <AgentList />}

      {/* Compact: sidebar as sheet overlay */}
      {isCompact && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="data-[side=left]:w-60 data-[side=left]:sm:max-w-60 gap-0 p-0 bg-[var(--bg-secondary)]"
          >
            <SheetTitle className="sr-only">Agents</SheetTitle>
            <AgentList onAgentSelect={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Compact: toggle button for sidebar */}
        {isCompact && (
          <div className="flex items-center h-9 px-2 border-b border-[var(--border-subtle)] shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <PanelLeft size={14} />
              <span>Agents</span>
            </button>
          </div>
        )}

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
