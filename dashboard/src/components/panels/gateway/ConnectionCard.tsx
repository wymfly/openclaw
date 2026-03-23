"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGatewayStore, type GatewayStatus } from "@/stores/gateway";

const STATUS_CONFIG: Record<GatewayStatus, { color: string; icon: typeof Wifi }> = {
  connected: { color: "var(--success)", icon: Wifi },
  connecting: { color: "var(--warning)", icon: RefreshCw },
  reconnecting: { color: "var(--warning)", icon: RefreshCw },
  disconnected: { color: "var(--neutral-muted-text)", icon: WifiOff },
  error: { color: "var(--danger)", icon: AlertCircle },
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
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("connection")}
        </h3>
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: config.color }}
          title={status}
        />
      </div>

      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: config.color }} />
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          {t(statusI18nKey(status))}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {t("latency")}
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>
          {latency !== null ? `${latency}ms` : "—"}
        </span>
      </div>
    </div>
  );
}
