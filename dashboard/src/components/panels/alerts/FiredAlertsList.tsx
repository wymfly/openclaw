"use client";

import { BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FiredAlert } from "@/stores/alerts";

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] border-transparent";
    case "warning":
      return "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-transparent";
    case "info":
    default:
      return "bg-[var(--accent-muted)] text-[var(--accent)] border-transparent";
  }
}

export function FiredAlertsList({ alerts }: { alerts: FiredAlert[] }) {
  const t = useTranslations("alerts");

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--text-secondary)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
          <BellOff size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{t("noFiredAlerts")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Card key={alert.id} size="sm" className="card-hover py-3">
          <CardContent className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate text-[var(--text-primary)]">
                  {alert.ruleName}
                </span>
                <Badge className={severityBadgeClass(alert.severity)}>{t(alert.severity)}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-[var(--text-secondary)]">
                  {t("triggerDetails")}: {alert.condition} ={" "}
                  <span className="font-mono">{alert.actualValue}</span> ({t("threshold")}:{" "}
                  <span className="font-mono">{alert.threshold}</span>)
                </span>
                <span className="text-xs text-[var(--text-secondary)] font-mono">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
