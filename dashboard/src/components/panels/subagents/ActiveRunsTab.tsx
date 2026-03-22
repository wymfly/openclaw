"use client";

import { GitBranch, List, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LineageTree } from "@/components/shared/LineageTree";
import { SubagentRunCard } from "@/components/shared/SubagentRunCard";
import { TreeDAG, type TreeDAGNode } from "@/components/shared/TreeDAG";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navigateToSession } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useDeckSubagentsStore, type SubagentRun } from "@/stores/deck-subagents";
import { SteerDialog } from "./SteerDialog";

/**
 * Active Runs tab — real-time subagent run monitoring with polling,
 * agent/status filters, tree-nested card layout, topology DAG view,
 * lineage visualization, and steer dialog.
 */
export function ActiveRunsTab() {
  const t = useTranslations("subagents");
  const tc = useTranslations("common");
  const { activeRuns, lineage, startPolling, stopPolling, killRun, steerRun, fetchLineage } =
    useDeckSubagentsStore();
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [killTargetRunId, setKillTargetRunId] = useState<string | null>(null);
  const [selectedLineageRunId, setSelectedLineageRunId] = useState<string | null>(null);
  const [steerTargetRunId, setSteerTargetRunId] = useState<string | null>(null);

  // View mode: default to "topology" when there are hierarchical runs
  const hasHierarchy = activeRuns.length >= 2 && activeRuns.some((r) => r.requesterSessionKey);
  const [viewMode, setViewMode] = useState<"list" | "topology">(hasHierarchy ? "topology" : "list");

  // Update default view mode when hierarchy status changes
  useEffect(() => {
    if (hasHierarchy) {
      setViewMode("topology");
    }
  }, [hasHierarchy]);

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
      runs = runs.filter((r) => r.childAgentId === agentFilter);
    }
    if (statusFilter !== "all") {
      runs = runs.filter((r) => r.status === statusFilter);
    }
    return runs;
  }, [activeRuns, agentFilter, statusFilter]);

  // Build tree structure for list view: group by requester, nest children under parents
  const { roots, childMap } = useMemo(() => {
    const map = new Map<string, SubagentRun[]>();
    const rootRuns: SubagentRun[] = [];
    for (const run of filtered) {
      if (run.requesterSessionKey) {
        const siblings = map.get(run.requesterSessionKey) ?? [];
        siblings.push(run);
        map.set(run.requesterSessionKey, siblings);
      } else {
        rootRuns.push(run);
      }
    }
    return { roots: rootRuns, childMap: map };
  }, [filtered]);

  // Build DAG nodes for topology view
  const dagNodes: TreeDAGNode[] = useMemo(
    () =>
      filtered.map((run) => ({
        id: run.runId,
        parentId:
          filtered.find((r) => r.childSessionKey === run.requesterSessionKey)?.runId ?? null,
        label: run.childAgentName ?? run.childAgentId,
        sublabel: run.task,
        status: run.status,
        startedAt: run.startedAt ?? run.createdAt,
        durationMs: run.durationMs,
        sessionKey: run.childSessionKey,
      })),
    [filtered],
  );

  const handleKillConfirm = useCallback(async () => {
    if (killTargetRunId) {
      await killRun(killTargetRunId);
      setKillTargetRunId(null);
    }
  }, [killTargetRunId, killRun]);

  const handleViewSession = useCallback((sessionKey: string) => {
    navigateToSession(sessionKey);
  }, []);

  const handleSteer = useCallback(
    async (instruction: string) => {
      if (!steerTargetRunId) {
        return;
      }
      const result = await steerRun(steerTargetRunId, instruction);
      if (!result) {
        throw new Error(t("steerError"));
      }
    },
    [steerTargetRunId, steerRun, t],
  );

  const handleDAGNodeClick = useCallback((node: TreeDAGNode) => {
    if (node.sessionKey) {
      navigateToSession(node.sessionKey);
    }
  }, []);

  // Render steer button for DAG node actions
  const renderDAGActions = useCallback(
    (node: TreeDAGNode) => {
      const isActive = node.status === "active";
      if (isActive) {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5 cursor-pointer text-[var(--accent)] hover:text-[var(--accent)]"
            onClick={(e) => {
              e.stopPropagation();
              setSteerTargetRunId(node.id);
            }}
          >
            <Navigation size={10} className="mr-0.5" />
            {t("steer")}
          </Button>
        );
      }
      return (
        <Tooltip>
          <TooltipTrigger render={<span />} className="inline-flex">
            <span className="h-5 text-[10px] px-1.5 text-[var(--text-secondary)] opacity-50 inline-flex items-center gap-0.5">
              <Navigation size={10} />
              {t("steer")}
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("steerDisabledTooltip")}</TooltipContent>
        </Tooltip>
      );
    },
    [t],
  );

  // Fetch lineage when a run is selected
  useEffect(() => {
    if (selectedLineageRunId) {
      void fetchLineage({ runId: selectedLineageRunId });
    }
  }, [selectedLineageRunId, fetchLineage]);

  const activeCount = activeRuns.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar: filters + view toggle + stats */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0 flex-wrap">
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "all")}>
          <SelectTrigger className="w-[160px] h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder={t("allAgents")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allAgents")}</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name || a.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder={t("allStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="active">{t("statusActive")}</SelectItem>
            <SelectItem value="completed">{t("statusCompleted")}</SelectItem>
            <SelectItem value="failed">{t("statusFailed")}</SelectItem>
            <SelectItem value="timeout">{t("statusTimeout")}</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] p-0.5 bg-[var(--bg-primary)]">
          <Tooltip>
            <TooltipTrigger render={<span />} className="inline-flex">
              <button
                type="button"
                className={cn(
                  "p-1 rounded cursor-pointer transition-colors",
                  viewMode === "list"
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
                onClick={() => setViewMode("list")}
                aria-label={t("viewList")}
              >
                <List size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("viewList")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<span />} className="inline-flex">
              <button
                type="button"
                className={cn(
                  "p-1 rounded cursor-pointer transition-colors",
                  viewMode === "topology"
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
                onClick={() => setViewMode("topology")}
                aria-label={t("viewTopology")}
              >
                <GitBranch size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("viewTopology")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] border",
              activeCount > 0
                ? "bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/25"
                : "text-[var(--text-secondary)]",
            )}
          >
            {t("activeCount")}: {activeCount}
          </Badge>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--text-secondary)]">{t("noActiveRuns")}</p>
          </div>
        ) : viewMode === "topology" ? (
          /* Topology (DAG) view */
          <div className="flex justify-center py-4">
            <TreeDAG
              nodes={dagNodes}
              onNodeClick={handleDAGNodeClick}
              renderActions={renderDAGActions}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Run cards in tree layout */}
            <div className="space-y-2">
              {roots.map((run) => (
                <RunTreeNode
                  key={run.runId}
                  run={run}
                  childMap={childMap}
                  depth={0}
                  onKill={setKillTargetRunId}
                  onViewSession={handleViewSession}
                  onSelectLineage={setSelectedLineageRunId}
                  onSteer={setSteerTargetRunId}
                  selectedLineageRunId={selectedLineageRunId}
                />
              ))}
            </div>

            {/* Lineage visualization */}
            {selectedLineageRunId && lineage.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">
                  {t("lineage")}
                </h3>
                <LineageTree nodes={lineage} rootSessionKey={selectedLineageRunId} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kill confirmation dialog */}
      <Dialog open={killTargetRunId !== null} onOpenChange={(o) => !o && setKillTargetRunId(null)}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">{t("kill")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("killConfirm")} <code className="text-xs font-mono">{killTargetRunId}</code>?
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setKillTargetRunId(null)}
              className="cursor-pointer"
            >
              {tc("cancel")}
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

      {/* Steer dialog */}
      {steerTargetRunId && (
        <SteerDialog
          open={steerTargetRunId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSteerTargetRunId(null);
            }
          }}
          runId={steerTargetRunId}
          onSteer={handleSteer}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree node — renders a run card with indented children (list view)
// ---------------------------------------------------------------------------

function RunTreeNode({
  run,
  childMap,
  depth,
  onKill,
  onViewSession,
  onSelectLineage,
  onSteer,
  selectedLineageRunId,
}: {
  run: SubagentRun;
  childMap: Map<string, SubagentRun[]>;
  depth: number;
  onKill: (runId: string) => void;
  onViewSession: (sessionKey: string) => void;
  onSelectLineage: (runId: string) => void;
  onSteer: (runId: string) => void;
  selectedLineageRunId: string | null;
}) {
  const t = useTranslations("subagents");
  const children = childMap.get(run.childSessionKey) ?? [];
  const isSelected = selectedLineageRunId === run.runId;

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
          onClick={() => onSelectLineage(run.runId)}
        >
          <SubagentRunCard run={run} onKill={onKill} onViewSession={onViewSession} />
        </button>
        {/* Steer action for active runs in list view */}
        {run.status === "active" && (
          <div className="flex justify-end px-2 pb-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5 cursor-pointer text-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => onSteer(run.runId)}
            >
              <Navigation size={10} className="mr-0.5" />
              {t("steer")}
            </Button>
          </div>
        )}
      </div>
      {children.map((child) => (
        <RunTreeNode
          key={child.runId}
          run={child}
          childMap={childMap}
          depth={depth + 1}
          onKill={onKill}
          onViewSession={onViewSession}
          onSelectLineage={onSelectLineage}
          onSteer={onSteer}
          selectedLineageRunId={selectedLineageRunId}
        />
      ))}
    </div>
  );
}
