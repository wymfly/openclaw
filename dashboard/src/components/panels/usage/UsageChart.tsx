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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("chart")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={timeseries}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              stroke="hsl(var(--border))"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              stroke="hsl(var(--border))"
            />
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
              stroke="var(--success)"
              fill="var(--success)"
              fillOpacity={0.3}
              name={t("tokensOut")}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
