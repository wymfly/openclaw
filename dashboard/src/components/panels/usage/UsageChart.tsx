"use client";

import { useTranslations } from "next-intl";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimeseriesPoint } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UsageChartProps {
  timeseries: TimeseriesPoint[];
}

export function UsageChart({ timeseries }: UsageChartProps) {
  const t = useTranslations("usage");

  if (timeseries.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        {t("chart")}
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={timeseries}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
            stroke="var(--border)"
          />
          <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} stroke="var(--border)" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label) => formatDate(Number(label))}
          />
          <Area
            type="monotone"
            dataKey="tokensIn"
            stackId="tokens"
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.4}
            name={t("tokensIn")}
          />
          <Area
            type="monotone"
            dataKey="tokensOut"
            stackId="tokens"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.3}
            name={t("tokensOut")}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
