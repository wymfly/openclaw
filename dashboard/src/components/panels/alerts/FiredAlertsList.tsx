"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FiredAlert } from "@/stores/alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FiredAlertsListProps = {
  alerts: FiredAlert[];
};

// ---------------------------------------------------------------------------
// Severity → Badge variant mapping
// ---------------------------------------------------------------------------

function severityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return { variant: "destructive" as const };
    case "warning":
      return {
        variant: undefined,
        className: "bg-[var(--warning)] text-[var(--warning-fg)] border-transparent",
      };
    case "info":
    default:
      return { variant: "default" as const };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FiredAlertsList({ alerts }: FiredAlertsListProps) {
  const t = useTranslations("alerts");

  if (alerts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">{t("noFiredAlerts")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const badge = severityBadge(alert.severity);
        return (
          <Card key={alert.id} size="sm" className="py-3">
            <CardContent className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate text-foreground">
                    {alert.ruleName}
                  </span>
                  <Badge variant={badge.variant} className={cn(badge.className)}>
                    {t(alert.severity)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {t("triggerDetails")}: {alert.condition} = {alert.actualValue} ({t("threshold")}
                    : {alert.threshold})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
