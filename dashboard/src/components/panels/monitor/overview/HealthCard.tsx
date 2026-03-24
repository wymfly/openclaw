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
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs">
          <Activity size={14} className="text-[var(--primary)]" />
          {t("health")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {healthLoading && !healthSummary ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--muted)]">
            <span className="text-xs text-[var(--muted-foreground)]">{tc("loading")}</span>
          </div>
        ) : (
          <>
            {/* Sessions metric */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--muted)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <Activity size={12} className="text-[var(--primary)]" />
                {t("sessions")}
              </span>
              <span className="text-xs font-mono font-medium text-[var(--foreground)]">
                {sessions
                  ? sessions.active != null && sessions.total != null
                    ? `${sessions.active} / ${sessions.total}`
                    : String(sessions.count ?? 0)
                  : "\u2014"}
              </span>
            </div>

            {/* Channels */}
            <div className="px-3 py-2 rounded-lg bg-[var(--muted)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mb-2">
                <Radio size={12} className="text-[var(--primary)]" />
                {t("channels")}
              </span>
              {channels ? (
                <div className="space-y-1.5">
                  {Object.entries(channels).map(([name, status]) => {
                    // status can be a string or an object { configured, lastError, ... }
                    let label: string;
                    let variant: "outline" | "default" | "secondary" | "destructive" = "outline";
                    if (typeof status === "string") {
                      label = status;
                    } else if (status && typeof status === "object") {
                      if (status.lastError) {
                        label = t("error");
                        variant = "destructive";
                      } else if (status.configured) {
                        label = t("connected");
                      } else {
                        label = t("offline");
                      }
                    } else {
                      label = "\u2014";
                    }
                    return (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-xs truncate text-[var(--foreground)]">{name}</span>
                        <Badge variant={variant} className="ml-2 shrink-0 text-[10px]">
                          {label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-[var(--muted-foreground)]">{"\u2014"}</span>
              )}
            </div>

            {/* Auth */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--muted)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <Shield size={12} className="text-[var(--primary)]" />
                Auth
              </span>
              <span className="text-xs font-medium text-[var(--foreground)]">
                {auth ?? "\u2014"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
