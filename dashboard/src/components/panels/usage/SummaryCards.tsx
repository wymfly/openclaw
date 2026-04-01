"use client";

import { useTranslations } from "next-intl";
import type { CostUsageTotals, SessionsUsageAggregates } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SummaryCardsProps {
  totals: CostUsageTotals | null;
  aggregates: SessionsUsageAggregates | null;
  loading: boolean;
}

export function SummaryCards({ totals, aggregates, loading }: SummaryCardsProps) {
  const t = useTranslations("usage");

  const cards: { label: string; value: string; loading: boolean }[] = [
    {
      label: t("tokensIn"),
      value: totals ? formatTokens(totals.input) : "—",
      loading: !totals && loading,
    },
    {
      label: t("tokensOut"),
      value: totals ? formatTokens(totals.output) : "—",
      loading: !totals && loading,
    },
    {
      label: t("totalCost"),
      value: totals ? formatCost(totals.totalCost) : "—",
      loading: !totals && loading,
    },
    {
      label: t("messages"),
      value: aggregates ? aggregates.messages.total.toLocaleString() : "—",
      loading: !aggregates && loading,
    },
    {
      label: t("toolCalls"),
      value: aggregates ? aggregates.tools.totalCalls.toLocaleString() : "—",
      loading: !aggregates && loading,
    },
    {
      label: t("avgLatency"),
      value: aggregates?.latency ? formatLatency(aggregates.latency.avgMs) : t("na"),
      loading: !aggregates && loading,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg p-3 border"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
            {card.label}
          </p>
          {card.loading ? (
            <div
              className="h-6 w-16 rounded animate-pulse"
              style={{ backgroundColor: "var(--muted)" }}
            />
          ) : (
            <p
              className="text-lg font-semibold tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
