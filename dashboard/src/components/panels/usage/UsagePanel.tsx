"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useUsageStore } from "@/stores/usage";
import { BreakdownTable } from "./BreakdownTable";
import { ContextPressure } from "./ContextPressure";
import { DateRangePicker } from "./DateRangePicker";
import { LatencyCard } from "./LatencyCard";
import { SessionUsageList } from "./SessionUsageList";
import { SummaryCards } from "./SummaryCards";
import { UsageChart } from "./UsageChart";

export function UsagePanel() {
  const t = useTranslations("usage");

  const {
    timeWindow,
    startDate,
    endDate,
    costFallback,
    sessionsUsage,
    costLoading,
    sessionsLoading,
    error,
    setTimeWindow,
    setCustomRange,
    fetchAll,
  } = useUsageStore();

  // Fetch data on mount and when date range changes
  useEffect(() => {
    void fetchAll();
  }, [startDate, endDate, fetchAll]);

  // Derive display data: prefer sessionsUsage, fall back to costFallback for totals
  const totals = sessionsUsage?.totals ?? costFallback?.totals ?? null;
  const aggregates = sessionsUsage?.aggregates ?? null;
  const isLoading = costLoading || sessionsLoading;

  // Force refresh (reset dedup)
  const handleRefresh = () => {
    useUsageStore.setState({ _lastFetchKey: "", _lastFetchTime: 0 });
    void fetchAll();
  };

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header: date range + refresh */}
      <div
        className="px-4 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {t("title")}
          </h2>
        </div>
        <DateRangePicker
          timeWindow={timeWindow}
          startDate={startDate}
          endDate={endDate}
          onWindowChange={setTimeWindow}
          onCustomRange={setCustomRange}
          onRefresh={handleRefresh}
          loading={isLoading}
        />
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ backgroundColor: "var(--background)" }}
      >
        {error && !isLoading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Summary cards — show as soon as any totals available */}
        <SummaryCards totals={totals} aggregates={aggregates} loading={isLoading} />

        {/* Time series chart */}
        {aggregates && <UsageChart daily={aggregates.daily} modelDaily={aggregates.modelDaily} />}

        {/* Main content: breakdown + context pressure side by side on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <BreakdownTable aggregates={aggregates} totals={totals} />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <ContextPressure />
            {aggregates && (
              <LatencyCard latency={aggregates.latency} dailyLatency={aggregates.dailyLatency} />
            )}
          </div>
        </div>

        {/* Session drilldown */}
        {sessionsUsage && <SessionUsageList sessions={sessionsUsage.sessions} />}

        {/* Empty state */}
        {!isLoading && !error && !totals && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{t("noData")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
