"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LineageTree } from "@/components/shared/LineageTree";
import { SubagentRunCard } from "@/components/shared/SubagentRunCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useDeckSubagentsStore, type SubagentRun } from "@/stores/deck-subagents";
import { useUIStore } from "@/stores/ui";

/**
 * Active Runs tab — real-time subagent run monitoring with polling,
 * agent/status filters, tree-nested card layout, and lineage visualization.
 */
export function ActiveRunsTab() {
  const t = useTranslations("subagents");
  const { activeRuns, lineage, startPolling, stopPolling, killRun, fetchLineage } =
    useDeckSubagentsStore();
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const setActivePanel = useUIStore((s) => s.setActivePanel);

  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [killTarget, setKillTarget] = useState<string | null>(null);
  const [selectedLineageKey, setSelectedLineageKey] = useState<string | null>(null);

  // Start polling on mount, stop on unmount
  useEffect(() => {
    startPolling();
    void fetchAgents();
    return () => stopPolling();
  }, [startPolling, stopPolling, fetchAgents]);

  // Filter active runs
  const filtered = useMemo(() => {
    let runs = activeRuns;
    if (agentFilter !== "all") {
      runs = runs.filter((r) => r.agentId === agentFilter);
    }
    if (statusFilter !== "all") {
      runs = runs.filter((r) => r.status === statusFilter);
    }
    return runs;
  }, [activeRuns, agentFilter, statusFilter]);

  // Build tree structure: group by parent, nest children under parents
  const { roots, childMap } = useMemo(() => {
    const map = new Map<string, SubagentRun[]>();
    const rootRuns: SubagentRun[] = [];
    for (const run of filtered) {
      if (run.parentSessionKey) {
        const siblings = map.get(run.parentSessionKey) ?? [];
        siblings.push(run);
        map.set(run.parentSessionKey, siblings);
      } else {
        rootRuns.push(run);
      }
    }
    return { roots: rootRuns, childMap: map };
  }, [filtered]);

  const handleKillConfirm = useCallback(async () => {
    if (killTarget) {
      await killRun(killTarget);
      setKillTarget(null);
    }
  }, [killTarget, killRun]);

  const handleViewSession = useCallback(
    (sessionKey: string) => {
      setActivePanel("sessions");
      // Session panel will pick up from URL / store state
      void sessionKey;
    },
    [setActivePanel],
  );

  // Fetch lineage when a run is selected
  useEffect(() => {
    if (selectedLineageKey) {
      void fetchLineage(selectedLineageKey);
    }
  }, [selectedLineageKey, fetchLineage]);

  const activeCount = activeRuns.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar: filters + stats */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0 flex-wrap">
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "all")}>
          <SelectTrigger className="w-[160px] h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name || a.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] border",
              activeCount > 0
                ? "bg-blue-500/15 text-blue-400 border-blue-500/25"
                : "text-[var(--text-secondary)]",
            )}
          >
            Active: {activeCount}
          </Badge>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--text-secondary)]">No active runs</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Run cards in tree layout */}
            <div className="space-y-2">
              {roots.map((run) => (
                <RunTreeNode
                  key={run.sessionKey}
                  run={run}
                  childMap={childMap}
                  depth={0}
                  onKill={setKillTarget}
                  onViewSession={handleViewSession}
                  onSelectLineage={setSelectedLineageKey}
                  selectedLineageKey={selectedLineageKey}
                />
              ))}
            </div>

            {/* Lineage visualization */}
            {selectedLineageKey && lineage.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">
                  {t("lineage")}
                </h3>
                <LineageTree nodes={lineage} rootSessionKey={selectedLineageKey} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kill confirmation dialog */}
      <Dialog open={killTarget !== null} onOpenChange={(o) => !o && setKillTarget(null)}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">{t("kill")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text-secondary)]">
            Terminate run <code className="text-xs font-mono">{killTarget}</code>?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKillTarget(null)} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleKillConfirm()}
              className="cursor-pointer"
            >
              {t("kill")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree node — renders a run card with indented children
// ---------------------------------------------------------------------------

function RunTreeNode({
  run,
  childMap,
  depth,
  onKill,
  onViewSession,
  onSelectLineage,
  selectedLineageKey,
}: {
  run: SubagentRun;
  childMap: Map<string, SubagentRun[]>;
  depth: number;
  onKill: (sessionKey: string) => void;
  onViewSession: (sessionKey: string) => void;
  onSelectLineage: (sessionKey: string) => void;
  selectedLineageKey: string | null;
}) {
  const children = childMap.get(run.sessionKey) ?? [];
  const isSelected = selectedLineageKey === run.sessionKey;

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div
        className={cn(
          "rounded-lg transition-colors",
          isSelected && "ring-1 ring-[var(--accent)]/40",
        )}
      >
        <button
          type="button"
          className="w-full text-left cursor-pointer"
          onClick={() => onSelectLineage(run.sessionKey)}
        >
          <SubagentRunCard run={run} onKill={onKill} onViewSession={onViewSession} />
        </button>
      </div>
      {children.map((child) => (
        <RunTreeNode
          key={child.sessionKey}
          run={child}
          childMap={childMap}
          depth={depth + 1}
          onKill={onKill}
          onViewSession={onViewSession}
          onSelectLineage={onSelectLineage}
          selectedLineageKey={selectedLineageKey}
        />
      ))}
    </div>
  );
}
