"use client";

import { HeartPulse, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("heartbeat")}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {statusLoading && !statusSummary ? (
          <span className="text-xs text-muted-foreground">{tc("loading")}</span>
        ) : (
          <>
            {/* Last heartbeat */}
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground">{t("lastHeartbeat")}</span>
              <span className="text-xs font-mono ml-auto text-foreground">
                {heartbeat && typeof heartbeat === "object"
                  ? `${(heartbeat as { agents?: unknown[] }).agents?.length ?? 0} agent(s)`
                  : ((heartbeat as string) ?? "—")}
              </span>
            </div>

            {/* Gateway state */}
            <div className="flex items-center gap-2">
              <HeartPulse
                size={14}
                className={state === "active" ? "text-[var(--success)]" : "text-[var(--warning)]"}
              />
              <span className="text-xs text-muted-foreground">{t("gatewayState")}</span>
              <span className="text-xs font-medium ml-auto text-foreground">
                {state ? t(state) : "—"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
