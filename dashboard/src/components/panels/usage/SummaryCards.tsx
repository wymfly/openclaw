"use client";

import { useTranslations } from "next-intl";
import type { UsageSummary } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SummaryCardsProps {
  summary: UsageSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const t = useTranslations("usage");

  const cards: { label: string; value: string }[] = [
    { label: t("tokensIn"), value: formatTokens(summary.tokensIn) },
    { label: t("tokensOut"), value: formatTokens(summary.tokensOut) },
    { label: t("totalTokens"), value: formatTokens(summary.totalTokens) },
    { label: t("totalCost"), value: formatCost(summary.totalCost) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            {card.label}
          </p>
          <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
