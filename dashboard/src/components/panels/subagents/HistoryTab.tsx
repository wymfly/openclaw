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

const statusBadge: Record<string, { label: string; color: string }> = {
  completed: { label: "Done", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  failed: { label: "Failed", color: "bg-red-500/15 text-red-400 border-red-500/25" },
  timeout: { label: "Timeout", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  running: { label: "Running", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
};

function formatDuration(start: string, end?: string): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((endMs - startMs) / 1000);
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
      runs = runs.filter((r) => new Date(r.startedAt).getTime() >= cutoff);
    }

    // Agent filter
    if (agentFilter !== "all") {
      runs = runs.filter((r) => r.agentId === agentFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      runs = runs.filter((r) => r.status === statusFilter);
    }

    // Sort newest first
    return [...runs].toSorted(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
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
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="6h">Last 6h</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

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
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-[10px] text-[var(--text-secondary)]">
          {filtered.length} runs
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
            <p className="text-sm text-[var(--text-secondary)]">No runs found</p>
            <p className="text-xs text-[var(--text-secondary)] opacity-60">{t("ephemeralNote")}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Header row */}
            <div className="grid grid-cols-[auto_1fr_1fr_2fr_80px_80px] gap-3 px-4 py-2 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              <span className="w-5" />
              <span>Agent</span>
              <span>Parent</span>
              <span>Task</span>
              <span>Duration</span>
              <span>Status</span>
            </div>

            {visible.map((run) => (
              <HistoryRow
                key={run.sessionKey}
                run={run}
                expanded={expandedKey === run.sessionKey}
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
              Load more ({filtered.length - visibleCount} remaining)
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
  const badge = statusBadge[run.status] ?? statusBadge.completed;
  const isFailed = run.status === "failed";

  return (
    <>
      <button
        type="button"
        onClick={() => onToggle(run.sessionKey)}
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
              run.status === "running" && "bg-blue-400",
            )}
          />
        </span>

        {/* Child agent */}
        <span className="flex items-center min-w-0">
          <AgentBadge agentId={run.agentId} agentName={run.agentName} emoji={run.agentEmoji} />
        </span>

        {/* Parent agent */}
        <span className="flex items-center min-w-0">
          {run.requesterAgentId ? (
            <span className="text-xs text-[var(--text-secondary)] truncate">
              {run.requesterAgentId}
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
            {formatDuration(run.startedAt, run.completedAt)}
          </span>
        </span>

        {/* Status badge */}
        <span className="flex items-center">
          <Badge variant="outline" className={cn("text-[10px] border", badge.color)}>
            {badge.label}
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
                  Task
                </span>
                <p className="text-xs text-[var(--text-primary)] mt-0.5 whitespace-pre-wrap">
                  {run.task}
                </p>
              </div>
            )}
            <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
              <span>depth: {run.depth}</span>
              {run.model && <span>model: {run.model}</span>}
              <span>session: {run.sessionKey}</span>
            </div>
            {isFailed && (
              <div className="rounded-md p-2 bg-red-500/10 border border-red-500/20">
                <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider">
                  Error
                </span>
                <p className="text-xs text-red-300 mt-0.5">
                  Run failed
                  {run.completedAt ? ` at ${new Date(run.completedAt).toLocaleString()}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
