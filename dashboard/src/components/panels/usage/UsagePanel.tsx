"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useUsageStore, type TimeWindow } from "@/stores/usage";
import { BreakdownTable } from "./BreakdownTable";
import { ContextPressure } from "./ContextPressure";
import { SummaryCards } from "./SummaryCards";
import { UsageChart } from "./UsageChart";

// ---------------------------------------------------------------------------
// Time-window selector buttons
// ---------------------------------------------------------------------------

const TIME_WINDOWS: TimeWindow[] = ["today", "7d", "30d"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // Fetch data on mount and when the time window changes.
  useEffect(() => {
    void fetchUsage();
    void fetchTimeseries();
  }, [timeWindow, fetchUsage, fetchTimeseries]);

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header with time-window selector */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h2>
        <div className="flex gap-1">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              className="px-3 py-1 text-xs rounded-md font-medium transition-colors"
              style={{
                backgroundColor: timeWindow === w ? "var(--accent)" : "transparent",
                color: timeWindow === w ? "#fff" : "var(--text-secondary)",
              }}
              onClick={() => setTimeWindow(w)}
            >
              {t(w)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        {loading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{error}</p>
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
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{t("noData")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
