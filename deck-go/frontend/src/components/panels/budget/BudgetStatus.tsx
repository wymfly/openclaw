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

function formatBudgetValue(
  value: number | null | undefined,
  dimension: DeckGoBudgetRule["dimension"],
) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
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

function budgetProgressPercent(evaluation: DeckGoBudgetEvaluation) {
  const threshold = evaluation.overThreshold ?? evaluation.warnThreshold ?? 0;
  if (threshold <= 0) {
    return 0;
  }
  return Math.min((evaluation.current / threshold) * 100, 100);
}

export function BudgetStatus(props: { evaluations: DeckGoBudgetEvaluation[] }) {
  const t = useTranslations("budget");

  if (props.evaluations.length === 0) {
    return null;
  }

  return (
    <section className="deck-ui-control-stack deck-ui-budget-status">
      <h3 className="deck-ui-control-section-title">{t("status")}</h3>
      <div className="deck-ui-control-status-list">
        {props.evaluations.map((evaluation) => (
          <article className="deck-ui-control-status-card" key={evaluation.ruleId}>
            <div className="deck-ui-control-status-header">
              <strong>{evaluation.ruleName}</strong>
              <span className={`deckgo-pill ${statusPillClass(evaluation.status)}`}>
                {t(evaluation.status)}
              </span>
            </div>
            <div className="deck-ui-control-progress-track">
              <div
                className={`deck-ui-control-progress-bar ${statusPillClass(evaluation.status)}`}
                style={{ width: `${budgetProgressPercent(evaluation)}%` }}
              />
            </div>
            <div className="deck-ui-control-status-meta">
              <span>
                {t("current")}: {formatBudgetValue(evaluation.current, evaluation.dimension)}
              </span>
              <span>
                {evaluation.overThreshold != null
                  ? `${t("overThreshold")}: ${formatBudgetValue(
                      evaluation.overThreshold,
                      evaluation.dimension,
                    )}`
                  : evaluation.warnThreshold != null
                    ? `${t("warnThreshold")}: ${formatBudgetValue(
                        evaluation.warnThreshold,
                        evaluation.dimension,
                      )}`
                    : ""}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
