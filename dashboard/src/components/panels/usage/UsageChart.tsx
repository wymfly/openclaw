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
  Legend,
} from "recharts";
import type { TimeseriesPoint } from "@/stores/usage";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface UsageChartProps {
  timeseries: TimeseriesPoint[];
}

export function UsageChart({ timeseries }: UsageChartProps) {
  const t = useTranslations("usage");

  if (timeseries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("chart")}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={timeseries}>
          <defs>
            <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              borderRadius: 10,
              fontSize: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}
            labelFormatter={(label) => formatDate(Number(label))}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Area
            type="monotone"
            dataKey="tokensIn"
            stackId="tokens"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#gradIn)"
            name={t("tokensIn")}
          />
          <Area
            type="monotone"
            dataKey="tokensOut"
            stackId="tokens"
            stroke="var(--success)"
            strokeWidth={2}
            fill="url(#gradOut)"
            name={t("tokensOut")}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
