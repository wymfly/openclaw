"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BudgetRule, RuleEvaluation } from "@/stores/budget";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ok: "bg-[var(--success-muted)] text-[var(--success-muted-text)] border-transparent",
  warn: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-transparent",
  over: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] border-transparent",
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
    return <p className="text-xs p-3 text-center text-[var(--text-secondary)]">{t("noRules")}</p>;
  }

  return (
    <div className="flex flex-col px-2 py-1 space-y-0.5">
      {rules.map((rule) => {
        const evaluation = evalByRuleId.get(rule.id);
        const status = evaluation?.status ?? (rule.enabled ? "ok" : undefined);
        const badgeClass = status ? STATUS_BADGE_CLASSES[status] : undefined;
        const isActive = selectedRuleId === rule.id;

        return (
          <button
            key={rule.id}
            type="button"
            className={cn(
              "relative w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
              isActive
                ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
            )}
            onClick={() => onSelect(rule)}
          >
            {/* Active indicator */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                aria-hidden
              />
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{rule.name}</span>
              <div className="flex items-center gap-1.5">
                {badgeClass && <Badge className={badgeClass}>{t(status!)}</Badge>}
                {!rule.enabled && (
                  <Badge className="bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)] border-transparent">
                    {t("disabled")}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs mt-0.5 text-[var(--text-secondary)]">
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
