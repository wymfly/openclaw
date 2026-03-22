"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useGatewayStore, type GatewayStatus } from "@/stores/gateway";

const STATUS_CONFIG: Record<
  GatewayStatus,
  { dot: string; textClass: string; badgeClass: string; icon: typeof Wifi }
> = {
  connected: {
    dot: "bg-[var(--status-connected)]",
    textClass: "text-[var(--success-muted-text)]",
    badgeClass: "bg-[var(--success-muted)] text-[var(--success-muted-text)] border-0",
    icon: Wifi,
  },
  connecting: {
    dot: "bg-[var(--status-reconnecting)]",
    textClass: "text-[var(--warning-muted-text)]",
    badgeClass: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-0",
    icon: RefreshCw,
  },
  reconnecting: {
    dot: "bg-[var(--status-reconnecting)]",
    textClass: "text-[var(--warning-muted-text)]",
    badgeClass: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-0",
    icon: RefreshCw,
  },
  disconnected: {
    dot: "bg-[var(--text-secondary)]",
    textClass: "text-[var(--text-secondary)]",
    badgeClass: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)] border-0",
    icon: WifiOff,
  },
  error: {
    dot: "bg-[var(--danger)]",
    textClass: "text-[var(--danger-muted-text)]",
    badgeClass: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] border-0",
    icon: AlertCircle,
  },
};

function statusI18nKey(status: GatewayStatus): string {
  if (status === "connecting") {
    return "reconnecting";
  }
  return status;
}

export function ConnectionCard() {
  const t = useTranslations("gateway");
  const { status, latency } = useGatewayStore();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <Icon size={14} className={config.textClass} />
            {t("connection")}
          </span>
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              config.dot,
              (status === "connected" || status === "connecting" || status === "reconnecting") &&
                "animate-pulse",
            )}
          />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <Badge className={config.badgeClass}>{t(statusI18nKey(status))}</Badge>
        </div>

        {/* Latency metric */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
          <span className="text-[11px] text-[var(--text-secondary)]">{t("latency")}</span>
          <span className="text-xs font-mono font-medium text-[var(--text-primary)]">
            {latency !== null ? `${latency}ms` : "\u2014"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
