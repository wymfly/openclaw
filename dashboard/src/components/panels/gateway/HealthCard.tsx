"use client";

import { Activity, Radio, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGatewayStore } from "@/stores/gateway";

export function HealthCard() {
  const t = useTranslations("gateway");
  const tc = useTranslations("common");
  const { healthSummary, healthLoading, fetchHealth } = useGatewayStore();

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  const sessions = healthSummary?.sessions;
  const channels = healthSummary?.channels;
  const auth = healthSummary?.auth;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("health")}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {healthLoading && !healthSummary ? (
          <span className="text-xs text-muted-foreground">{tc("loading")}</span>
        ) : (
          <>
            {/* Sessions */}
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground">{t("sessions")}</span>
              <span className="text-xs font-mono ml-auto text-foreground">
                {sessions ? `${sessions.active} / ${sessions.total}` : "—"}
              </span>
            </div>

            {/* Channels */}
            <div className="flex items-start gap-2">
              <Radio size={14} className="mt-0.5 shrink-0 text-primary" />
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">{t("channels")}</span>
                {channels ? (
                  Object.entries(channels).map(([name, status]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-xs truncate text-foreground">{name}</span>
                      <Badge variant="outline" className="ml-2 shrink-0">
                        {status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-foreground">—</span>
                )}
              </div>
            </div>

            {/* Auth */}
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground">Auth</span>
              <span className="text-xs ml-auto text-foreground">{auth ?? "—"}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
