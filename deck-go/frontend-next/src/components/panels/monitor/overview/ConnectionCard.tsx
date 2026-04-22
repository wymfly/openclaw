"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMonitorStore, type GatewayStatus } from "@/stores/monitor";

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
    dot: "bg-[var(--muted-foreground)]",
    textClass: "text-[var(--muted-foreground)]",
    badgeClass: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)] border-0",
    icon: WifiOff,
  },
  error: {
    dot: "bg-[var(--destructive)]",
    textClass: "text-[var(--destructive-muted-text)]",
    badgeClass: "bg-[var(--destructive-muted)] text-[var(--destructive-muted-text)] border-0",
    icon: AlertCircle,
  },
};

const RUNTIME_POLL_MS = 15_000;

function statusI18nKey(status: GatewayStatus): string {
  if (status === "connecting") {
    return "reconnecting";
  }
  return status;
}

function runtimeStatusI18nKey(status?: string): string {
  switch (status) {
    case "stopped":
    case "starting":
    case "running":
    case "degraded":
    case "stopping":
    case "failed":
      return status;
    default:
      return "unknown";
  }
}

function runtimeHealthI18nKey(health?: string): string {
  switch (health) {
    case "healthy":
    case "unhealthy":
      return health;
    default:
      return "unknown";
  }
}

export function ConnectionCard({ className }: { className?: string }) {
  const t = useTranslations("monitor");
  const tc = useTranslations("common");
  const status = useMonitorStore((s) => s.gatewayStatus);
  const latency = useMonitorStore((s) => s.gatewayLatency);
  const runtimeGateway = useMonitorStore((s) => s.runtimeGateway);
  const runtimeGatewayLoading = useMonitorStore((s) => s.runtimeGatewayLoading);
  const runtimeGatewayAction = useMonitorStore((s) => s.runtimeGatewayAction);
  const runtimeGatewayError = useMonitorStore((s) => s.runtimeGatewayError);
  const fetchRuntimeGateway = useMonitorStore((s) => s.fetchRuntimeGateway);
  const startRuntimeGateway = useMonitorStore((s) => s.startRuntimeGateway);
  const restartRuntimeGateway = useMonitorStore((s) => s.restartRuntimeGateway);
  const stopRuntimeGateway = useMonitorStore((s) => s.stopRuntimeGateway);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const runtimeStatus = runtimeGateway?.status;
  const runtimeConfigured = runtimeGateway?.configured ?? false;
  const runtimeActionPending = runtimeGatewayAction !== "idle";

  useEffect(() => {
    void fetchRuntimeGateway();
    const id = setInterval(() => void fetchRuntimeGateway(), RUNTIME_POLL_MS);
    return () => clearInterval(id);
  }, [fetchRuntimeGateway]);

  const canStart =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "running" &&
    runtimeStatus !== "starting";
  const canRestart =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "stopped" &&
    runtimeStatus !== "stopping" &&
    runtimeStatus !== "starting";
  const canStop =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "stopped" &&
    runtimeStatus !== "stopping";

  return (
    <Card className={cn("card-hover", className)}>
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
        <CardAction>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => void fetchRuntimeGateway()}
            disabled={runtimeGatewayLoading || runtimeActionPending}
          >
            {t("runtime.refresh")}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={config.badgeClass}>{t(statusI18nKey(status))}</Badge>
          <Badge variant="outline">
            {t("runtime.status")}: {t(`runtime.statusValues.${runtimeStatusI18nKey(runtimeStatus)}`)}
          </Badge>
          <Badge variant="outline">
            {t("runtime.health")}:{" "}
            {t(`runtime.healthValues.${runtimeHealthI18nKey(runtimeGateway?.health)}`)}
          </Badge>
        </div>

        {runtimeGatewayLoading && !runtimeGateway ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--muted)]">
            <span className="text-xs text-[var(--muted-foreground)]">{tc("loading")}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--muted)]">
              <span className="text-[11px] text-[var(--muted-foreground)]">{t("latency")}</span>
              <span className="text-xs font-mono font-medium text-[var(--foreground)]">
                {latency !== null ? `${latency}ms` : "\u2014"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--muted)]">
              <span className="text-[11px] text-[var(--muted-foreground)]">{t("runtime.url")}</span>
              <span className="text-xs font-mono font-medium text-right text-[var(--foreground)] break-all">
                {runtimeGateway?.gatewayUrl || "\u2014"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--muted)]">
              <span className="text-[11px] text-[var(--muted-foreground)]">
                {t("runtime.lastError")}
              </span>
              <span className="text-xs font-medium text-right text-[var(--foreground)] break-all">
                {runtimeGateway?.lastError || t("runtime.none")}
              </span>
            </div>
            {!runtimeConfigured && (
              <div className="px-3 py-2 text-xs rounded-lg bg-[var(--warning-muted)] text-[var(--warning-muted-text)]">
                {t("runtime.notConfigured")}
              </div>
            )}
          </div>
        )}

        {runtimeGatewayError && (
          <div className="px-3 py-2 text-xs rounded-lg bg-[var(--destructive-muted)] text-[var(--destructive-muted-text)]">
            {runtimeGatewayError}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="xs"
            onClick={() => void startRuntimeGateway()}
            disabled={!canStart}
          >
            {runtimeGatewayAction === "starting" ? t("runtime.starting") : t("runtime.actions.start")}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void restartRuntimeGateway()}
            disabled={!canRestart}
          >
            {runtimeGatewayAction === "restarting"
              ? t("runtime.restarting")
              : t("runtime.actions.restart")}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="destructive"
            onClick={() => void stopRuntimeGateway()}
            disabled={!canStop}
          >
            {runtimeGatewayAction === "stopping" ? t("runtime.stopping") : t("runtime.actions.stop")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
