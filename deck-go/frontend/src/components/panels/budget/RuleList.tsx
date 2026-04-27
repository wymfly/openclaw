import type { DeckGoBudgetEvaluation, DeckGoBudgetRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

function statusPillClass(status: DeckGoBudgetEvaluation["status"]) {
  if (status === "over") {
    return "is-danger";
  }
  if (status === "warn") {
    return "is-warning";
  }
  return "is-positive";
}

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
}) {
  const t = useTranslations("budget");
  const evaluationByRuleId = new Map(props.evaluations.map((item) => [item.ruleId, item]));

  if (props.rules.length === 0) {
    return <p className="deck-ui-control-empty">{t("noRules")}</p>;
  }

  return (
    <div className="deck-ui-control-list deck-ui-budget-list">
      {props.rules.map((rule) => {
        const evaluation = evaluationByRuleId.get(rule.id);
        const status = evaluation?.status ?? (rule.enabled ? "ok" : undefined);
        return (
          <button
            key={rule.id}
            type="button"
            className={`deck-ui-control-row deck-ui-budget-row ${
              props.selectedRuleId === rule.id ? "is-selected" : ""
            }`}
            onClick={() => props.onSelect(rule)}
          >
            <span className="deck-ui-control-row-header">
              <strong>{rule.name}</strong>
              <span className="deck-ui-control-row-pills">
                {status ? (
                  <span className={`deckgo-pill ${statusPillClass(status)}`}>{t(status)}</span>
                ) : null}
                {!rule.enabled ? (
                  <span className="deckgo-pill is-muted">{t("disabled")}</span>
                ) : null}
              </span>
            </span>
            <span className="deckgo-meta">
              {t(rule.dimension)} · {t(rule.period)} · {t(scopeLabelKey(rule))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
