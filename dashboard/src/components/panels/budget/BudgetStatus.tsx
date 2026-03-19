"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RuleEvaluation } from "@/stores/budget";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ok: "bg-[var(--success-muted)] text-[var(--success)] border-transparent",
  warn: "bg-[var(--warning-muted)] text-[var(--warning)] border-transparent",
  over: "bg-[var(--danger-muted)] text-[var(--danger)] border-transparent",
};

const STATUS_BAR_COLORS: Record<string, string> = {
  ok: "bg-[var(--success)]",
  warn: "bg-[var(--warning)]",
  over: "bg-[var(--danger)]",
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
      <h3 className="text-sm font-medium text-foreground">{t("status")}</h3>

      <div className="flex flex-col gap-2">
        {evaluations.map((ev) => {
          const badgeClass = STATUS_BADGE_CLASSES[ev.status] ?? STATUS_BADGE_CLASSES.ok;
          const barColor = STATUS_BAR_COLORS[ev.status] ?? STATUS_BAR_COLORS.ok;
          const maxThreshold = ev.overThreshold ?? ev.warnThreshold ?? 0;
          const progressPercent =
            maxThreshold > 0 ? Math.min((ev.current / maxThreshold) * 100, 100) : 0;

          return (
            <Card key={ev.ruleId} size="sm" className="py-3">
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{ev.ruleName}</span>
                  <Badge className={badgeClass}>{t(ev.status)}</Badge>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden mb-1 bg-border">
                  <div
                    className={cn("h-full rounded-full transition-all", barColor)}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
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
              </CardContent>
            </Card>
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
