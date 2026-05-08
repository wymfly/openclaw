import type { DeckGoBudgetEvaluation, DeckGoBudgetRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { budgetStatusClass, formatBudgetValue } from "./BudgetStatus";

function scopeLabelKey(rule: DeckGoBudgetRule) {
  if (rule.scope === "agent" || rule.scope === "perAgent" || rule.agentId) {
    return "perAgent";
  }
  if (rule.scope === "task" || rule.scope === "perTask" || rule.taskId) {
    return "perTask";
  }
  return "global";
}

export function RuleList(props: {
  rules: DeckGoBudgetRule[];
  evaluations: DeckGoBudgetEvaluation[];
  selectedRuleId: string | null;
  onSelect: (rule: DeckGoBudgetRule) => void;
  activeCriteria?: string;
  clearLabel?: string;
  emptyLabel: string;
  onClearFilters?: () => void;
}) {
  const t = useTranslations("budget");
  const evaluationByRuleId = new Map(props.evaluations.map((item) => [item.ruleId, item]));

  if (props.rules.length === 0) {
    return (
      <div className="budget-panel__empty">
        <p>{props.emptyLabel}</p>
        {props.activeCriteria ? <p>{props.activeCriteria}</p> : null}
        {props.activeCriteria && props.clearLabel && props.onClearFilters ? (
          <button className="budget-panel__button" type="button" onClick={props.onClearFilters}>
            {props.clearLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="budget-panel__catalog">
      {props.rules.map((rule) => {
        const evaluation = evaluationByRuleId.get(rule.id);
        const status = evaluation?.status ?? (rule.enabled ? "ok" : undefined);
        return (
          <button
            key={rule.id}
            type="button"
            className={`budget-panel__row ${props.selectedRuleId === rule.id ? "is-selected" : ""}`}
            aria-pressed={props.selectedRuleId === rule.id}
            onClick={() => props.onSelect(rule)}
          >
            <span className="budget-panel__row-head">
              <strong>{rule.name}</strong>
              <span className="budget-panel__pill-row">
                {status ? (
                  <span className={`budget-panel__pill ${budgetStatusClass(status)}`}>
                    {t(status)}
                  </span>
                ) : null}
                {!rule.enabled ? (
                  <span className="budget-panel__pill is-muted">{t("disabled")}</span>
                ) : null}
              </span>
            </span>
            <span className="budget-panel__meta">
              {t(rule.dimension)} · {t(rule.period)} · {t(scopeLabelKey(rule))}
            </span>
            <span className="budget-panel__meta">
              {evaluation
                ? `${t("current")}: ${formatBudgetValue(evaluation.current, evaluation.dimension)}`
                : t("notEvaluated")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
