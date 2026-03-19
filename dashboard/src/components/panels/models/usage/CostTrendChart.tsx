"use client";

import { ArrowRight, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyCost } from "@/stores/models";

interface CostTrendChartProps {
  data: DailyCost[];
}

/**
 * 7-day cost trend as a bar chart. Transparent background, CSS-variable
 * colours so it works in both light and dark mode.
 */
export function CostTrendChart({ data }: CostTrendChartProps) {
  const t = useTranslations("models.usage");

  const chartData = useMemo(() => {
    return data.slice(-7).map((d) => ({
      ...d,
      // Short date label: M/D
      shortDate: formatShortDate(d.date),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-[var(--text-secondary)]">No cost data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs">
          <BarChart3 size={14} className="text-[var(--accent)]" />
          {t("weekCost")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="shortDate"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v}`}
              width={48}
            />
            <Tooltip content={<CostTooltip />} cursor={{ fill: "var(--accent-muted)" }} />
            <Bar dataKey="cost" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>

        {/* Footer link */}
        <button
          type="button"
          className="mt-3 flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors cursor-pointer"
        >
          {t("viewDetails")}
          <ArrowRight size={12} />
        </button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

interface TooltipPayloadEntry {
  value: number;
  payload: { date: string; cost: number; shortDate: string };
}

interface CostTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CostTooltip({ active, payload }: CostTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-[var(--text-secondary)]">{entry.payload.date}</p>
      <p className="text-sm font-mono font-bold text-[var(--text-primary)]">
        ${entry.value.toFixed(2)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Date formatter                                                     */
/* ------------------------------------------------------------------ */

function formatShortDate(dateStr: string): string {
  // Expect ISO date string "YYYY-MM-DD"
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const month = Number.parseInt(parts[1], 10);
    const day = Number.parseInt(parts[2], 10);
    return `${month}/${day}`;
  }
  return dateStr;
}
