"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import type { UsageSummary } from "@/stores/usage";

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
        <Card key={card.label} size="sm">
          <CardContent>
            <p className="text-xs font-medium mb-1 text-muted-foreground">{card.label}</p>
            <p className="text-xl font-semibold text-foreground">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
