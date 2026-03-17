"use client";

import { useTranslations } from "next-intl";
import type { BudgetRule, RuleEvaluation } from "@/stores/budget";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ok: { bg: "var(--success-muted)", text: "var(--success)" },
  warn: { bg: "var(--warning-muted)", text: "var(--warning)" },
  over: { bg: "var(--danger-muted)", text: "var(--danger)" },
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
    return (
      <p className="text-xs p-3 text-center" style={{ color: "var(--text-secondary)" }}>
        {t("noRules")}
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {rules.map((rule) => {
        const evaluation = evalByRuleId.get(rule.id);
        const status = evaluation?.status ?? (rule.enabled ? "ok" : undefined);
        const colors = status ? STATUS_COLORS[status] : undefined;

        return (
          <button
            key={rule.id}
            type="button"
            className="w-full text-left px-3 py-2.5 border-b transition-colors"
            style={{
              borderColor: "var(--border)",
              backgroundColor: selectedRuleId === rule.id ? "var(--bg-primary)" : "transparent",
            }}
            onClick={() => onSelect(rule)}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {rule.name}
              </span>
              <div className="flex items-center gap-1.5">
                {colors && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {t(status!)}
                  </span>
                )}
                {!rule.enabled && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--neutral-muted)",
                      color: "var(--neutral-muted-text)",
                    }}
                  >
                    {t("disabled")}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
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
