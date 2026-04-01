"use client";

import { useTranslations } from "next-intl";
import type { RuleEvaluation } from "@/stores/budget";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ok: { bg: "var(--success-muted)", text: "var(--success)" },
  warn: { bg: "var(--warning-muted)", text: "var(--warning)" },
  over: { bg: "var(--destructive-muted)", text: "var(--destructive)" },
};

interface BudgetStatusProps {
  evaluations: RuleEvaluation[];
}

export function BudgetStatus({ evaluations }: BudgetStatusProps) {
  const t = useTranslations("budget");

  if (evaluations.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {t("status")}
      </h3>

      <div className="flex flex-col gap-2">
        {evaluations.map((ev) => {
          const colors = STATUS_COLORS[ev.status] ?? STATUS_COLORS.ok;
          const maxThreshold = ev.overThreshold ?? ev.warnThreshold ?? 0;
          const progressPercent =
            maxThreshold > 0 ? Math.min((ev.current / maxThreshold) * 100, 100) : 0;

          return (
            <div
              key={ev.ruleId}
              className="p-3 rounded-md border"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {ev.ruleName}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  {t(ev.status)}
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="h-2 rounded-full overflow-hidden mb-1"
                style={{ backgroundColor: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: colors.text,
                  }}
                />
              </div>

              <div
                className="flex justify-between text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span>
                  {t("current")}: {formatValue(ev.current, ev.dimension)}
                </span>
                <span>
                  {ev.overThreshold != null
                    ? `${t("overThreshold")}: ${formatValue(ev.overThreshold, ev.dimension)}`
                    : ev.warnThreshold != null
                      ? `${t("warnThreshold")}: ${formatValue(ev.warnThreshold, ev.dimension)}`
                      : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatValue(value: number, dimension: string): string {
  if (dimension === "cost") {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}
