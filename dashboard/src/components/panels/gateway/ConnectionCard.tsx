"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGatewayStore, type GatewayStatus } from "@/stores/gateway";

const STATUS_CONFIG: Record<
  GatewayStatus,
  { textClass: string; bgClass: string; icon: typeof Wifi }
> = {
  connected: { textClass: "text-[var(--success)]", bgClass: "bg-[var(--success)]", icon: Wifi },
  connecting: {
    textClass: "text-[var(--warning)]",
    bgClass: "bg-[var(--warning)]",
    icon: RefreshCw,
  },
  reconnecting: {
    textClass: "text-[var(--warning)]",
    bgClass: "bg-[var(--warning)]",
    icon: RefreshCw,
  },
  disconnected: {
    textClass: "text-muted-foreground",
    bgClass: "bg-muted-foreground",
    icon: WifiOff,
  },
  error: { textClass: "text-destructive", bgClass: "bg-destructive", icon: AlertCircle },
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
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {t("connection")}
          <span className={`w-2.5 h-2.5 rounded-full ${config.bgClass}`} title={status} />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className={config.textClass} />
          <Badge variant="outline">{t(statusI18nKey(status))}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("latency")}</span>
          <span className="text-xs font-mono text-foreground">
            {latency !== null ? `${latency}ms` : "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
