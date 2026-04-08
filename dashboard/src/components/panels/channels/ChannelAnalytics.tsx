"use client";

import { BarChart3, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useChannelsStore } from "@/stores/channels";
import { ThroughputChart } from "./ThroughputChart";

interface ChannelAnalyticsProps {
  channelId: string;
}

/**
 * Channel Analytics composite view — summary cards + extended throughput + error overview.
 */
export function ChannelAnalytics({ channelId }: ChannelAnalyticsProps) {
  const t = useTranslations("channels");
  const { throughput, fetchThroughput, channelHealthMap } = useChannelsStore();

  useEffect(() => {
    fetchThroughput(channelId);
  }, [channelId, fetchThroughput]);

  const data = throughput.get(channelId);
  const health = channelHealthMap.get(channelId);

  const totalIn = data?.messagesIn ?? 0;
  const totalOut = data?.messagesOut ?? 0;
  const errorRate = health?.status === "down" ? 100 : health?.status === "degraded" ? 50 : 0;

  const summaryCards = [
    {
      label: t("analytics.totalIn"),
      value: totalIn.toLocaleString(),
      icon: <TrendingUp size={14} />,
      color: "text-[var(--success)]",
    },
    {
      label: t("analytics.totalOut"),
      value: totalOut.toLocaleString(),
      icon: <BarChart3 size={14} />,
      color: "text-[var(--primary)]",
    },
    {
      label: t("analytics.errorRate"),
      value: `${errorRate}%`,
      icon: <AlertTriangle size={14} />,
      color: errorRate > 0 ? "text-[var(--destructive)]" : "text-[var(--success)]",
    },
    {
      label: t("analytics.latency"),
      value: health?.latencyMs != null ? `${health.latencyMs}ms` : "\u2014",
      icon: <Clock size={14} />,
      color: "text-[var(--primary)]",
    },
  ];

  return (
    <div className="space-y-4 p-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {summaryCards.map((card) => (
          <Card key={card.label} className="bg-[var(--background)] border-[var(--border)]">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mb-1">
                <span className={card.color}>{card.icon}</span>
                {card.label}
              </div>
              <p className="text-sm font-semibold font-mono text-[var(--foreground)]">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Throughput chart */}
      <Card className="bg-[var(--background)] border-[var(--border)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">{t("analytics.throughput")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ThroughputChart channelId={channelId} />
        </CardContent>
      </Card>

      {/* Empty state */}
      {!data && (
        <div className="text-center py-8">
          <p className="text-xs text-[var(--muted-foreground)]">{t("analytics.noData")}</p>
        </div>
      )}
    </div>
  );
}
