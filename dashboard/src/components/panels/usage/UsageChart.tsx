"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyAggregate, SessionDailyModelUsage } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartView = "tokens" | "cost" | "byModel";

interface UsageChartProps {
  daily: DailyAggregate[];
  modelDaily?: SessionDailyModelUsage[];
}

// ---------------------------------------------------------------------------
// Colors for model stacking
// ---------------------------------------------------------------------------

const MODEL_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--purple)",
  "var(--destructive)",
  "var(--muted-foreground)",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsageChart({ daily, modelDaily }: UsageChartProps) {
  const t = useTranslations("usage");
  const [view, setView] = useState<ChartView>("tokens");

  // Build model stacked data: pivot modelDaily into { date, model1: tokens, model2: tokens, ... }
  const { modelData, modelNames } = useMemo(() => {
    if (!modelDaily || modelDaily.length === 0) return { modelData: [], modelNames: [] };

    const dateMap = new Map<string, Record<string, number | string>>();
    const names = new Set<string>();

    for (const entry of modelDaily) {
      // Replace dots in model names to prevent Recharts path-based key resolution
      const name = (entry.model ?? entry.provider ?? "unknown").replaceAll(".", "_");
      names.add(name);
      const row = dateMap.get(entry.date) ?? { date: entry.date };
      row[name] = ((row[name] as number) ?? 0) + entry.tokens;
      dateMap.set(entry.date, row);
    }

    return {
      modelData: Array.from(dateMap.values()).sort((a, b) =>
        (a.date as string).localeCompare(b.date as string),
      ),
      modelNames: Array.from(names),
    };
  }, [modelDaily]);

  if (daily.length === 0) return null;

  const views: { key: ChartView; label: string }[] = [
    { key: "tokens", label: t("chartTokens") },
    { key: "cost", label: t("chartCost") },
  ];
  if (modelNames.length > 0) {
    views.push({ key: "byModel", label: t("chartByModel") });
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Header with view toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {t("chart")}
        </p>
        <div className="flex gap-1">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              className="px-2 py-1 text-xs rounded font-medium transition-colors"
              style={{
                backgroundColor: view === v.key ? "var(--accent)" : "transparent",
                color: view === v.key ? "var(--foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        {view === "byModel" ? (
          <AreaChart data={modelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {modelNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="models"
                stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
                fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        ) : (
          <AreaChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {view === "tokens" ? (
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.4}
                name={t("chartTokens")}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="cost"
                stroke="var(--success)"
                fill="var(--success)"
                fillOpacity={0.3}
                name={t("chartCost")}
              />
            )}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
