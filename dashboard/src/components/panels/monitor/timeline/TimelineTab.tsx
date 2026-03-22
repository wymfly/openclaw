"use client";

import { Activity, Clock, Hash, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMonitorStore } from "@/stores/monitor";
import { FileChangeSummary } from "./FileChangeSummary";
import { ModelStats } from "./ModelStats";
import { RunTimeline } from "./RunTimeline";
import { SubagentTree } from "./SubagentTree";
import { ToolWaterfall } from "./ToolWaterfall";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimelineTab() {
  const t = useTranslations("monitor");
  const tc = useTranslations("common");

  const { selectedRunId, runSummary, runEvents, runDetailLoading, fetchRunDetail, selectRun } =
    useMonitorStore();

  // Deep-link: check URL for ?runId=xxx on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const urlRunId = params.get("runId");
    if (urlRunId && !selectedRunId) {
      selectRun(urlRunId);
    }
  }, [selectedRunId, selectRun]);

  // Fetch run detail when selectedRunId changes
  useEffect(() => {
    if (selectedRunId) {
      void fetchRunDetail(selectedRunId);
    }
  }, [selectedRunId, fetchRunDetail]);

  // ── No run selected ──
  if (!selectedRunId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
        <Activity size={32} className="opacity-40" />
        <p className="text-sm">{t("timeline.selectRun")}</p>
      </div>
    );
  }

  // ── Loading ──
  if (runDetailLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
        {tc("loading")}
      </div>
    );
  }

  // ── No events ──
  if (runEvents.length === 0 && !runSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
        <Layers size={32} className="opacity-40" />
        <p className="text-sm">{t("noEvents")}</p>
      </div>
    );
  }

  // ── Run detail view ──
  const duration =
    runSummary?.endedAt && runSummary.startedAt ? runSummary.endedAt - runSummary.startedAt : null;

  return (
    <div className="p-4 space-y-5 overflow-auto">
      {/* Run header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Hash size={12} />
          <span className="font-mono text-[var(--text-primary)] select-all">
            {runSummary?.runId ?? selectedRunId}
          </span>
        </div>

        {runSummary?.agentName && (
          <span className="text-xs text-[var(--text-secondary)]">{runSummary.agentName}</span>
        )}

        {/* Summary metrics */}
        <div className="flex flex-wrap gap-3 ml-auto text-[11px] text-[var(--text-secondary)]">
          {runSummary?.eventCount != null && (
            <span>
              {t("timeline.events")}:{" "}
              <strong className="text-[var(--text-primary)] tabular-nums">
                {runSummary.eventCount}
              </strong>
            </span>
          )}
          {duration != null && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              <strong className="text-[var(--text-primary)] tabular-nums">
                {formatDuration(duration)}
              </strong>
            </span>
          )}
          {runSummary?.inputTokens != null && runSummary.inputTokens > 0 && (
            <span>
              {t("timeline.tokensIn")}:{" "}
              <strong className="text-[var(--text-primary)] tabular-nums">
                {formatTokens(runSummary.inputTokens)}
              </strong>
            </span>
          )}
          {runSummary?.outputTokens != null && runSummary.outputTokens > 0 && (
            <span>
              {t("timeline.tokensOut")}:{" "}
              <strong className="text-[var(--text-primary)] tabular-nums">
                {formatTokens(runSummary.outputTokens)}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Gantt timeline */}
      <section>
        <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          {t("timeline.ganttTitle")}
        </h4>
        <RunTimeline events={runEvents} />
      </section>

      {/* Tool waterfall */}
      <section>
        <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          {t("timeline.toolWaterfallTitle")}
        </h4>
        <ToolWaterfall events={runEvents} />
      </section>

      {/* File changes */}
      <section>
        <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          {t("timeline.fileChangesTitle")}
        </h4>
        <FileChangeSummary events={runEvents} />
      </section>

      {/* Model stats */}
      <section>
        <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          {t("timeline.modelStatsTitle")}
        </h4>
        <ModelStats events={runEvents} />
      </section>

      {/* Subagent tree — only rendered if events exist */}
      <SubagentTree events={runEvents} sessionKey={runSummary?.sessionKey ?? ""} />
    </div>
  );
}
