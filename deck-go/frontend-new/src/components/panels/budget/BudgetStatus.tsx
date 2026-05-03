import type { DeckGoBudgetEvaluation, DeckGoBudgetRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function budgetStatusTone(status: DeckGoBudgetEvaluation["status"]) {
  if (status === "over") {
    return "danger";
  }
  if (status === "warn") {
    return "warning";
  }
  return "positive";
}

export function budgetStatusClass(status: DeckGoBudgetEvaluation["status"]) {
  return `is-${budgetStatusTone(status)}`;
}

export function formatBudgetValue(
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

export function budgetProgressPercent(evaluation: DeckGoBudgetEvaluation) {
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
    <section className="budget-panel__surface" aria-label={t("status")}>
      <div className="budget-panel__card-head">
        <h3 className="budget-panel__card-title">{t("status")}</h3>
      </div>
      <div className="budget-panel__body budget-panel__status-list">
        {props.evaluations.map((evaluation) => (
          <article className="budget-panel__status-card" key={evaluation.ruleId}>
            <div className="budget-panel__status-head">
              <strong>{evaluation.ruleName}</strong>
              <span className={`budget-panel__pill ${budgetStatusClass(evaluation.status)}`}>
                {t(evaluation.status)}
              </span>
            </div>
            <progress
              className={`budget-panel__progress ${budgetStatusClass(evaluation.status)}`}
              max={100}
              value={budgetProgressPercent(evaluation)}
              aria-label={t("progressLabel", { name: evaluation.ruleName })}
            />
            <div className="budget-panel__status-meta">
              <span>
                {t("current")}: {formatBudgetValue(evaluation.current, evaluation.dimension)}
              </span>
              <span>
                {evaluation.warnThreshold != null
                  ? `${t("warnThreshold")}: ${formatBudgetValue(
                      evaluation.warnThreshold,
                      evaluation.dimension,
                    )}`
                  : t("notAvailable")}
              </span>
              <span>
                {evaluation.overThreshold != null
                  ? `${t("overThreshold")}: ${formatBudgetValue(
                      evaluation.overThreshold,
                      evaluation.dimension,
                    )}`
                  : t("notAvailable")}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
