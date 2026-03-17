"use client";

import { useTranslations } from "next-intl";
import type { FiredAlert } from "@/stores/alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FiredAlertsListProps = {
  alerts: FiredAlert[];
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  info: { bg: "var(--accent)", text: "#fff" },
  warning: { bg: "#f59e0b", text: "#fff" },
  critical: { bg: "#ef4444", text: "#fff" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FiredAlertsList({ alerts }: FiredAlertsListProps) {
  const t = useTranslations("alerts");

  if (alerts.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12"
        style={{ color: "var(--text-secondary)" }}
      >
        <p className="text-sm">{t("noFiredAlerts")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const colors = SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.info;
        return (
          <div
            key={alert.id}
            className="flex items-center justify-between px-4 py-3 rounded-lg border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {alert.ruleName}
                </span>
                <span
                  className="px-2 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                  }}
                >
                  {t(alert.severity)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {t("triggerDetails")}: {alert.condition} = {alert.actualValue} ({t("threshold")}:{" "}
                  {alert.threshold})
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
