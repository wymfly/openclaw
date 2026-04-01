"use client";

import { Clock, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useMonitorStore, type RunListItem, type RunStatus } from "@/stores/monitor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60_000)}m`;
}

/** Map a time-range label to an ISO datetime `since` string. */
function timeRangeToSince(range: string): string | null {
  const now = Date.now();
  switch (range) {
    case "1h":
      return new Date(now - 60 * 60 * 1000).toISOString();
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

/** Derive the current time-range label from the `since` filter value (ISO string). */
function sinceToTimeRange(since: string | null): string {
  if (since == null) {
    return "all";
  }
  const delta = Date.now() - new Date(since).getTime();
  if (delta <= 60 * 60 * 1000 + 5000) {
    return "1h";
  }
  if (delta <= 24 * 60 * 60 * 1000 + 5000) {
    return "24h";
  }
  if (delta <= 7 * 24 * 60 * 60 * 1000 + 5000) {
    return "7d";
  }
  return "all";
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-[var(--success-muted)] text-[var(--success)]",
  error: "bg-[var(--destructive-muted)] text-[var(--destructive)]",
  running: "bg-[var(--primary-muted)] text-[var(--primary)]",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  completed: "history.completed",
  error: "history.error",
  running: "history.running",
};

// Time range options for the select dropdown.
const TIME_RANGES = ["1h", "24h", "7d", "all"] as const;

// Status options for the status filter (null = all).
const STATUS_OPTIONS: Array<RunStatus | "all"> = ["all", "running", "completed", "error"];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status, label }: { status: string; label: string }) {
  const style = STATUS_STYLES[status] ?? "bg-[var(--primary-muted)] text-[var(--primary)]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${style}`}
    >
      {status === "running" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}

function RunRow({
  run,
  t,
  onClick,
}: {
  run: RunListItem;
  t: ReturnType<typeof useTranslations>;
  onClick: () => void;
}) {
  const startMs = new Date(run.firstEventAt).getTime();
  const endMs = new Date(run.lastEventAt).getTime();
  const duration = run.lastEventAt && run.firstEventAt ? endMs - startMs : null;
  const totalTokens = run.totalTokens ?? 0;
  const statusLabel = t(STATUS_LABEL_KEY[run.status] ?? "history.running");

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--background)] transition-colors"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Top line: status + run ID + agent/session */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <StatusBadge status={run.status} label={statusLabel} />
        <span className="font-mono text-xs text-[var(--foreground)] truncate select-all">
          {run.runId.length > 12 ? `${run.runId.slice(0, 12)}...` : run.runId}
        </span>
        <span className="text-xs text-[var(--muted-foreground)] truncate">
          {run.agentId ?? t("history.unknownAgent")}
          {run.sessionKey ? ` / ${run.sessionKey}` : ""}
        </span>
      </div>

      {/* Bottom line: inline metrics */}
      <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
        {run.eventCount > 0 && (
          <span>
            {run.eventCount} {t("history.events")}
          </span>
        )}
        {totalTokens > 0 && <span>{formatTokens(totalTokens)} tokens</span>}
        {duration != null && (
          <span className="flex items-center gap-0.5">
            <Clock size={10} />
            {formatDuration(duration)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryTab
// ---------------------------------------------------------------------------

export function HistoryTab() {
  const t = useTranslations("monitor");
  const tc = useTranslations("common");

  const {
    runs,
    runsLoading,
    nextCursor,
    filters,
    fetchRuns,
    loadMoreRuns,
    setFilter,
    clearFilters,
    selectRun,
    setActiveTab,
  } = useMonitorStore();

  // ── Initial fetch on mount ──
  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  // ── Filter reactivity: re-fetch when filters change ──
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    // Skip the initial render
    if (prevFiltersRef.current === filters) {
      return;
    }
    prevFiltersRef.current = filters;
    void fetchRuns();
  }, [filters, fetchRuns]);

  // ── Infinite scroll ──
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !runsLoading && nextCursor) {
          void loadMoreRuns();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [runsLoading, nextCursor, loadMoreRuns]);

  // ── Handlers ──
  const hasActiveFilters =
    filters.agentId != null ||
    filters.sessionKey != null ||
    filters.since != null ||
    filters.status != null;

  const handleTimeRangeChange = useCallback(
    (value: string | null) => {
      setFilter("since", timeRangeToSince(value ?? "all"));
    },
    [setFilter],
  );

  const handleStatusChange = useCallback(
    (value: string | null) => {
      setFilter("status", !value || value === "all" ? null : (value as RunStatus));
    },
    [setFilter],
  );

  const handleSelectRun = useCallback(
    (runId: string) => {
      selectRun(runId);
      setActiveTab("timeline");
    },
    [selectRun, setActiveTab],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0">
        {/* Agent filter */}
        <Input
          placeholder={t("history.filterAgent")}
          value={filters.agentId ?? ""}
          onChange={(e) => setFilter("agentId", e.target.value || null)}
          className="w-28 h-7 text-xs"
        />

        {/* Session filter */}
        <Input
          placeholder={t("history.filterSession")}
          value={filters.sessionKey ?? ""}
          onChange={(e) => setFilter("sessionKey", e.target.value || null)}
          className="w-28 h-7 text-xs"
        />

        {/* Time range */}
        <Select value={sinceToTimeRange(filters.since)} onValueChange={handleTimeRangeChange}>
          <SelectTrigger size="sm" className="text-xs min-w-[5.5rem]">
            <span>{t(`history.time.${sinceToTimeRange(filters.since)}`)}</span>
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`history.time.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={filters.status ?? "all"} onValueChange={handleStatusChange}>
          <SelectTrigger size="sm" className="text-xs min-w-[5.5rem]">
            <span>
              {(filters.status ?? "all") === "all"
                ? t("history.allStatus")
                : t(STATUS_LABEL_KEY[filters.status!] ?? "history.running")}
            </span>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? t("history.allStatus") : t(STATUS_LABEL_KEY[s] ?? "history.running")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="xs"
            onClick={clearFilters}
            className="text-xs text-[var(--muted-foreground)]"
          >
            <X size={12} />
            {t("history.clearFilters")}
          </Button>
        )}
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-auto">
        {runs.length === 0 && !runsLoading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--muted-foreground)]">
            <Search size={32} className="opacity-40" />
            <p className="text-sm">{t("history.noRuns")}</p>
          </div>
        ) : (
          <>
            {runs.map((run) => (
              <RunRow key={run.runId} run={run} t={t} onClick={() => handleSelectRun(run.runId)} />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={scrollSentinelRef} className="h-px" />

            {/* Loading spinner */}
            {runsLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" />
                <span className="ml-2 text-xs text-[var(--muted-foreground)]">{tc("loading")}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
