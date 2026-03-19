"use client";

import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useUsageStore, type TimeWindow } from "@/stores/usage";
import { BreakdownTable } from "./BreakdownTable";
import { ContextPressure } from "./ContextPressure";
import { SummaryCards } from "./SummaryCards";
import { UsageChart } from "./UsageChart";

const TIME_WINDOWS: TimeWindow[] = ["today", "7d", "30d"];

export function UsagePanel() {
  const t = useTranslations("usage");
  const tc = useTranslations("common");

  const {
    summary,
    modelBreakdown,
    agentBreakdown,
    timeseries,
    timeWindow,
    loading,
    error,
    setTimeWindow,
    fetchUsage,
    fetchTimeseries,
  } = useUsageStore();

  useEffect(() => {
    void fetchUsage();
    void fetchTimeseries();
  }, [timeWindow, fetchUsage, fetchTimeseries]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Header with time-window selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("title")}</h2>
        <div className="flex gap-1 rounded-lg bg-[var(--bg-tertiary)] p-0.5">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                timeWindow === w
                  ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => setTimeWindow(w)}
            >
              {t(w)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-secondary)]">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
              <BarChart3 size={18} className="text-[var(--accent)] animate-pulse" />
            </div>
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center py-16">
            <div className="px-4 py-2.5 rounded-lg bg-[var(--danger-muted)] text-[var(--danger-muted-text)] text-sm">
              {error}
            </div>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <SummaryCards summary={summary} />
            <UsageChart timeseries={timeseries} />
            <ContextPressure />
            <BreakdownTable modelBreakdown={modelBreakdown} agentBreakdown={agentBreakdown} />
          </>
        )}

        {!loading && !error && !summary && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-secondary)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
              <BarChart3 size={20} className="text-[var(--accent)]" />
            </div>
            <p className="text-sm">{t("noData")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
