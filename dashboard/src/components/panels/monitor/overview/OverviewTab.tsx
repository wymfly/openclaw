"use client";

import { BarChart3, CalendarClock, Clock, Cpu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMonitorStore } from "@/stores/monitor";
import { ConnectionCard } from "./ConnectionCard";
import { HealthCard } from "./HealthCard";
import { HeartbeatCard } from "./HeartbeatCard";
import { LiveFeed } from "./LiveFeed";

/** Format duration in ms to a human-readable string. */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function OverviewTab() {
  const t = useTranslations("monitor");
  const tc = useTranslations("common");
  const { stats, statsLoading, fetchStats } = useMonitorStore();

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <div className="p-4 space-y-5">
      {/* Stats summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="card-hover">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-muted)]">
              <BarChart3 size={14} className="text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {t("stats.totalRuns")}
              </p>
              <p className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
                {statsLoading && !stats ? tc("loading") : (stats?.totalRuns ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--success-muted)]">
              <CalendarClock size={14} className="text-[var(--success)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {t("stats.todayRuns")}
              </p>
              <p className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
                {statsLoading && !stats ? tc("loading") : (stats?.todayRuns ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--warning-muted)]">
              <Clock size={14} className="text-[var(--warning)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {t("stats.avgDuration")}
              </p>
              <p className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
                {statsLoading && !stats
                  ? tc("loading")
                  : stats?.avgDurationMs
                    ? formatDuration(stats.avgDurationMs)
                    : "\u2014"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-muted)]">
              <Cpu size={14} className="text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {t("stats.topAgents")}
              </p>
              <p className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
                {statsLoading && !stats ? tc("loading") : (stats?.topAgents?.length ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostics cards */}
      <div>
        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3 px-0.5">
          {t("diagnostics")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ConnectionCard />
          <HealthCard />
          <HeartbeatCard />
        </div>
      </div>

      {/* Live feed */}
      <div>
        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3 px-0.5">
          {t("liveFeed")}
        </h3>
        <LiveFeed />
      </div>
    </div>
  );
}
