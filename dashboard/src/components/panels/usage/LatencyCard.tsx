"use client";

import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SessionLatencyStats, SessionDailyLatency } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LatencyCardProps {
  latency?: SessionLatencyStats;
  dailyLatency?: SessionDailyLatency[];
}

export function LatencyCard({ latency, dailyLatency }: LatencyCardProps) {
  const t = useTranslations("usage");

  // Conditional rendering: don't show if no latency data
  if (!latency) return null;

  const stats: { label: string; value: string }[] = [
    { label: t("latencyAvg"), value: formatMs(latency.avgMs) },
    { label: t("latencyP95"), value: formatMs(latency.p95Ms) },
    { label: t("latencyMin"), value: formatMs(latency.minMs) },
    { label: t("latencyMax"), value: formatMs(latency.maxMs) },
  ];

  // Only show trend chart if more than 1 day of data
  const showTrend = dailyLatency && dailyLatency.length > 1;

  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <p className="text-sm font-medium mb-3" style={{ color: "var(--foreground)" }}>
        {t("latency")}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {s.label}
            </p>
            <p
              className="text-base font-semibold tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      {showTrend && (
        <>
          <p
            className="text-xs font-medium mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("latencyTrend")}
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={dailyLatency}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickFormatter={(v: number) => formatMs(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [formatMs(Number(value)), ""]}
              />
              <Line
                type="monotone"
                dataKey="avgMs"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                name={t("latencyAvg")}
              />
              <Line
                type="monotone"
                dataKey="p95Ms"
                stroke="var(--warning)"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                name={t("latencyP95")}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
