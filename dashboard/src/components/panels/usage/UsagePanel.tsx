"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col h-full rounded-lg overflow-hidden border border-border">
      {/* Header with time-window selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <div className="flex gap-1">
          {TIME_WINDOWS.map((w) => (
            <Button
              key={w}
              variant={timeWindow === w ? "default" : "ghost"}
              size="xs"
              onClick={() => setTimeWindow(w)}
            >
              {t(w)}
            </Button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
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
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">{t("noData")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
