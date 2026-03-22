"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

const statusBadgeColor: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  failed: "bg-red-500/15 text-red-400 border-red-500/25",
  timeout: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  active: "bg-blue-500/15 text-blue-400 border-blue-500/25",
};

const statusI18nKey: Record<string, string> = {
  completed: "completed",
  failed: "failed",
  timeout: "timeout",
  active: "activeCount",
};

function formatDuration(durationMs?: number, startMs?: number, endMs?: number): string {
  if (durationMs !== undefined) {
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainSec = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${remainSec}s`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  if (startMs === undefined) {
    return "—";
  }
  const end = endMs ?? Date.now();
  const seconds = Math.floor((end - startMs) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainSec}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Time range helpers
// ---------------------------------------------------------------------------

type TimeRange = "1h" | "6h" | "24h" | "all";

function getTimeRangeMs(range: TimeRange): number | null {
  switch (range) {
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "all":
      return null;
  }
}

/**
 * History tab — table of completed/failed/timeout runs with filters,
 * expandable rows for details, and pagination via "Load more".
 */
export function HistoryTab() {
  const t = useTranslations("subagents");
  const { historyRuns, fetchRuns, loading } = useDeckSubagentsStore();
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  // Fetch on mount
  useEffect(() => {
    void fetchRuns();
    void fetchAgents();
  }, [fetchRuns, fetchAgents]);

  // Filter history runs
  const filtered = useMemo(() => {
    let runs = historyRuns;

    // Time range filter
    const rangeMs = getTimeRangeMs(timeRange);
    if (rangeMs) {
      const cutoff = Date.now() - rangeMs;
      runs = runs.filter((r) => (r.startedAt ?? r.createdAt) >= cutoff);
    }

    // Agent filter
    if (agentFilter !== "all") {
      runs = runs.filter((r) => r.childAgentId === agentFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      runs = runs.filter((r) => r.status === statusFilter);
    }

    // Sort newest first
    return [...runs].toSorted(
      (a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt),
    );
  }, [historyRuns, timeRange, agentFilter, statusFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleToggleExpand = useCallback(
    (key: string) => {
      setExpandedKey(expandedKey === key ? null : key);
    },
    [expandedKey],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0 flex-wrap">
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">{t("timeRange.1h")}</SelectItem>
            <SelectItem value="6h">{t("timeRange.6h")}</SelectItem>
            <SelectItem value="24h">{t("timeRange.24h")}</SelectItem>
            <SelectItem value="all">{t("timeRange.all")}</SelectItem>
          </SelectContent>
        </Select>

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
            <SelectItem value="completed">{t("completed")}</SelectItem>
            <SelectItem value="failed">{t("failed")}</SelectItem>
            <SelectItem value="timeout">{t("timeout")}</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-[10px] text-[var(--text-secondary)]">
          {t("runs", { count: filtered.length })}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div
              className="animate-spin rounded-full h-6 w-6 border-2 border-current"
              style={{ borderTopColor: "transparent", color: "var(--text-secondary)" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm text-[var(--text-secondary)]">{t("noRunsFound")}</p>
            <p className="text-xs text-[var(--text-secondary)] opacity-60">{t("ephemeralNote")}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Header row */}
            <div className="grid grid-cols-[auto_1fr_1fr_2fr_80px_80px] gap-3 px-4 py-2 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              <span className="w-5" />
              <span>{t("agent")}</span>
              <span>{t("parent")}</span>
              <span>{t("task")}</span>
              <span>{t("duration")}</span>
              <span>{t("status")}</span>
            </div>

            {visible.map((run) => (
              <HistoryRow
                key={run.runId}
                run={run}
                expanded={expandedKey === run.runId}
                onToggle={handleToggleExpand}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisibleCount((c) => c + 20)}
              className="text-xs cursor-pointer"
            >
              {t("remaining", { count: filtered.length - visibleCount })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function HistoryRow({
  run,
  expanded,
  onToggle,
}: {
  run: SubagentRun;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  const t = useTranslations("subagents");
  const badgeColor = statusBadgeColor[run.status] ?? statusBadgeColor.completed;
  const badgeLabel = t(statusI18nKey[run.status] ?? "completed");
  const isFailed = run.status === "failed";

  return (
    <>
      <button
        type="button"
        onClick={() => onToggle(run.runId)}
        className={cn(
          "grid grid-cols-[auto_1fr_1fr_2fr_80px_80px] gap-3 px-4 py-2.5 w-full text-left transition-colors cursor-pointer",
          "hover:bg-[var(--bg-tertiary)]",
          isFailed && "bg-red-500/5",
          expanded && "bg-[var(--bg-tertiary)]",
        )}
      >
        {/* Status dot */}
        <span className="flex items-center w-5">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              run.status === "completed" && "bg-emerald-400",
              run.status === "failed" && "bg-red-400",
              run.status === "timeout" && "bg-amber-400",
              run.status === "active" && "bg-blue-400",
            )}
          />
        </span>

        {/* Child agent */}
        <span className="flex items-center min-w-0">
          <AgentBadge agentId={run.childAgentId} agentName={run.childAgentName} />
        </span>

        {/* Parent agent */}
        <span className="flex items-center min-w-0">
          {run.requesterAgentId ? (
            <span className="text-xs text-[var(--text-secondary)] truncate">
              {run.requesterAgentName ?? run.requesterAgentId}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-secondary)] opacity-40">—</span>
          )}
        </span>

        {/* Task (truncated) */}
        <span className="flex items-center min-w-0">
          <span className="text-xs text-[var(--text-primary)] truncate">{run.task ?? "—"}</span>
        </span>

        {/* Duration */}
        <span className="flex items-center">
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {formatDuration(run.durationMs, run.startedAt, run.endedAt)}
          </span>
        </span>

        {/* Status badge */}
        <span className="flex items-center">
          <Badge variant="outline" className={cn("text-[10px] border", badgeColor)}>
            {badgeLabel}
          </Badge>
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent)]/30">
          <div className="space-y-2">
            {run.task && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  {t("task")}
                </span>
                <p className="text-xs text-[var(--text-primary)] mt-0.5 whitespace-pre-wrap">
                  {run.task}
                </p>
              </div>
            )}
            <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
              <span>
                {t("depth")}: {run.depth}
              </span>
              {run.model && (
                <span>
                  {t("model")}: {run.model}
                </span>
              )}
              <span>
                {t("session")}: {run.childSessionKey}
              </span>
            </div>
            {isFailed && (
              <div className="rounded-md p-2 bg-red-500/10 border border-red-500/20">
                <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider">
                  {t("failed")}
                </span>
                <p className="text-xs text-red-300 mt-0.5">
                  {t("runFailed")}
                  {run.endedAt ? ` ${new Date(run.endedAt).toLocaleString()}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
