"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BudgetRule, RuleEvaluation } from "@/stores/budget";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ok: "bg-[var(--success-muted)] text-[var(--success)] border-transparent",
  warn: "bg-[var(--warning-muted)] text-[var(--warning)] border-transparent",
  over: "bg-[var(--danger-muted)] text-[var(--danger)] border-transparent",
};

interface RuleListProps {
  rules: BudgetRule[];
  evaluations: RuleEvaluation[];
  selectedRuleId: string | null;
  onSelect: (rule: BudgetRule) => void;
}

export function RuleList({ rules, evaluations, selectedRuleId, onSelect }: RuleListProps) {
  const t = useTranslations("budget");

  const evalByRuleId = new Map(evaluations.map((e) => [e.ruleId, e]));

  if (rules.length === 0) {
    return <p className="text-xs p-3 text-center text-muted-foreground">{t("noRules")}</p>;
  }

  return (
    <div className="flex flex-col">
      {rules.map((rule) => {
        const evaluation = evalByRuleId.get(rule.id);
        const status = evaluation?.status ?? (rule.enabled ? "ok" : undefined);
        const badgeClass = status ? STATUS_BADGE_CLASSES[status] : undefined;

        return (
          <button
            key={rule.id}
            type="button"
            className={cn(
              "w-full text-left px-3 py-2.5 border-b border-border transition-colors cursor-pointer",
              selectedRuleId === rule.id ? "bg-background" : "bg-transparent",
            )}
            onClick={() => onSelect(rule)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate text-foreground">{rule.name}</span>
              <div className="flex items-center gap-1.5">
                {badgeClass && <Badge className={badgeClass}>{t(status!)}</Badge>}
                {!rule.enabled && (
                  <Badge className="bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)] border-transparent">
                    {t("disabled")}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs mt-0.5 text-muted-foreground">
              {t(rule.dimension)} · {t(rule.period)} ·{" "}
              {t(
                rule.scope === "agent" ? "perAgent" : rule.scope === "task" ? "perTask" : "global",
              )}
            </p>
          </button>
        );
      })}
    </div>
  );
}
