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
          <Activity size={14} className="text-[var(--accent)]" />
          {t("health")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {healthLoading && !healthSummary ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
            <span className="text-xs text-[var(--text-secondary)]">{tc("loading")}</span>
          </div>
        ) : (
          <>
            {/* Sessions metric */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <Activity size={12} className="text-[var(--accent)]" />
                {t("sessions")}
              </span>
              <span className="text-xs font-mono font-medium text-[var(--text-primary)]">
                {sessions
                  ? sessions.active != null && sessions.total != null
                    ? `${sessions.active} / ${sessions.total}`
                    : String(sessions.count ?? 0)
                  : "\u2014"}
              </span>
            </div>

            {/* Channels */}
            <div className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mb-2">
                <Radio size={12} className="text-[var(--accent)]" />
                {t("channels")}
              </span>
              {channels ? (
                <div className="space-y-1.5">
                  {Object.entries(channels).map(([name, status]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-xs truncate text-[var(--text-primary)]">{name}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                        {status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">{"\u2014"}</span>
              )}
            </div>

            {/* Auth */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <Shield size={12} className="text-[var(--accent)]" />
                Auth
              </span>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {auth ?? "\u2014"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
