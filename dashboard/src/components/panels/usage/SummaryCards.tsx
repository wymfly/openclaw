"use client";

import { ArrowDownRight, ArrowUpRight, Sigma, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: string;
}

function MetricCard({ label, value, icon: Icon, accent = "var(--accent)" }: MetricCardProps) {
  return (
    <div className="group/card flex flex-col gap-2 rounded-xl bg-[var(--bg-secondary)] p-4 ring-1 ring-[var(--border)] card-hover cursor-default">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)` }}
        >
          <Icon size={14} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-xl font-semibold font-mono text-[var(--text-primary)] tracking-tight">
        {value}
      </p>
    </div>
  );
}

interface SummaryCardsProps {
  summary: UsageSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const t = useTranslations("usage");

  const cards: { label: string; value: string; icon: LucideIcon; accent: string }[] = [
    {
      label: t("tokensIn"),
      value: formatTokens(summary.tokensIn),
      icon: ArrowDownRight,
      accent: "var(--accent)",
    },
    {
      label: t("tokensOut"),
      value: formatTokens(summary.tokensOut),
      icon: ArrowUpRight,
      accent: "var(--success)",
    },
    {
      label: t("totalTokens"),
      value: formatTokens(summary.totalTokens),
      icon: Sigma,
      accent: "var(--purple)",
    },
    {
      label: t("totalCost"),
      value: formatCost(summary.totalCost),
      icon: DollarSign,
      accent: "var(--warning)",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <MetricCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
          accent={card.accent}
        />
      ))}
    </div>
  );
}
