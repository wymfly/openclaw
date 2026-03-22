"use client";

import { HeartPulse, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useGatewayStore } from "@/stores/gateway";

export function HeartbeatCard() {
  const t = useTranslations("gateway");
  const tc = useTranslations("common");
  const { statusSummary, statusLoading, fetchStatus } = useGatewayStore();

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const heartbeat = statusSummary?.heartbeat;
  const state = statusSummary?.state;

  const isActive = state === "active";

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs">
          <HeartPulse
            size={14}
            className={cn(
              isActive ? "text-[var(--success)]" : "text-[var(--warning)]",
              isActive && "status-pulse",
            )}
          />
          {t("heartbeat")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {statusLoading && !statusSummary ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
            <span className="text-xs text-[var(--text-secondary)]">{tc("loading")}</span>
          </div>
        ) : (
          <>
            {/* Last heartbeat */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <Clock size={12} className="text-[var(--accent)]" />
                {t("lastHeartbeat")}
              </span>
              <span className="text-xs font-mono font-medium text-[var(--text-primary)]">
                {heartbeat && typeof heartbeat === "object"
                  ? `${(heartbeat as { agents?: unknown[] }).agents?.length ?? 0} agent(s)`
                  : ((heartbeat as string) ?? "\u2014")}
              </span>
            </div>

            {/* Gateway state */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <HeartPulse
                  size={12}
                  className={isActive ? "text-[var(--success)]" : "text-[var(--warning)]"}
                />
                {t("gatewayState")}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive
                    ? "text-[var(--success-muted-text)]"
                    : "text-[var(--warning-muted-text)]",
                )}
              >
                {state ? t(state) : "\u2014"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
