"use client";

import { DollarSign, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AuthOverviewEntry, DailyCost } from "@/stores/models";

interface SummaryCardsProps {
  cost: DailyCost[];
  auth: AuthOverviewEntry[];
}

/**
 * Three summary metric cards: Today's Cost, This Week, Active Providers.
 */
export function SummaryCards({ cost, auth }: SummaryCardsProps) {
  const t = useTranslations("models.usage");

  const { todayCost, yesterdayCost, weekCost, prevWeekCost } = useMemo(() => {
    if (cost.length === 0) {
      return { todayCost: 0, yesterdayCost: 0, weekCost: 0, prevWeekCost: 0 };
    }

    // cost is assumed to be sorted by date ascending with the last entry being today
    const today = cost.length >= 1 ? cost[cost.length - 1].cost : 0;
    const yesterday = cost.length >= 2 ? cost[cost.length - 2].cost : 0;

    // Sum last 7 entries for this week
    const weekSlice = cost.slice(-7);
    const week = weekSlice.reduce((sum, d) => sum + d.cost, 0);

    // Previous 7 entries (days 8-14 from the end) for comparison
    const prevSlice = cost.slice(-14, -7);
    const prev = prevSlice.reduce((sum, d) => sum + d.cost, 0);

    return { todayCost: today, yesterdayCost: yesterday, weekCost: week, prevWeekCost: prev };
  }, [cost]);

  const { readyCount, totalCount } = useMemo(() => {
    const ready = auth.filter((a) => a.status === "ready").length;
    return { readyCount: ready, totalCount: auth.length };
  }, [auth]);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Today's Cost */}
      <MetricCard
        label={t("todayCost")}
        value={formatCost(todayCost)}
        comparison={
          yesterdayCost > 0
            ? { label: t("vsYesterday"), pct: pctChange(todayCost, yesterdayCost) }
            : undefined
        }
        icon={<DollarSign size={14} className="text-[var(--accent)]" />}
      />

      {/* This Week */}
      <MetricCard
        label={t("weekCost")}
        value={formatCost(weekCost)}
        comparison={
          prevWeekCost > 0
            ? { label: t("vsLastWeek"), pct: pctChange(weekCost, prevWeekCost) }
            : undefined
        }
        icon={<TrendingUp size={14} className="text-[var(--chart-2,#8b5cf6)]" />}
      />

      {/* Active Providers */}
      <MetricCard
        label={t("activeProviders")}
        value={`${readyCount} / ${totalCount}`}
        icon={<Zap size={14} className="text-[var(--chart-5,#f59e0b)]" />}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

interface MetricCardProps {
  label: string;
  value: string;
  comparison?: { label: string; pct: number };
  icon: React.ReactNode;
}

function MetricCard({ label, value, comparison, icon }: MetricCardProps) {
  const isDecrease = comparison != null && comparison.pct < 0;
  const isIncrease = comparison != null && comparison.pct > 0;

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">{value}</p>
        {comparison != null && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              isDecrease && "text-[var(--success-muted-text)]",
              isIncrease && "text-[var(--danger-muted-text)]",
              !isDecrease && !isIncrease && "text-[var(--text-secondary)]",
            )}
          >
            {isDecrease ? <TrendingDown size={12} /> : isIncrease ? <TrendingUp size={12} /> : null}
            {comparison.label}: {comparison.pct > 0 ? "+" : ""}
            {comparison.pct.toFixed(0)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}
