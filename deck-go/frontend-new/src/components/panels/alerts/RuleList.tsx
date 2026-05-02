import type { DeckGoAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function RuleList(props: {
  rules: DeckGoAlertRule[];
  onEdit: (rule: DeckGoAlertRule) => void;
  onDelete: (rule: DeckGoAlertRule) => void;
  onToggle: (rule: DeckGoAlertRule, enabled: boolean) => void;
}) {
  const t = useTranslations("alerts");

  if (props.rules.length === 0) {
    return <p className="deck-ui-control-empty">{t("noRules")}</p>;
  }

  return (
    <div className="deck-ui-control-list deck-ui-alerts-list">
      {props.rules.map((rule) => (
        <article className="deck-ui-control-row deck-ui-alerts-row" key={rule.id}>
          <div className="deck-ui-control-row-main">
            <span className="deck-ui-control-row-header">
              <strong>{rule.name}</strong>
              <span className="deck-ui-control-row-pills">
                <span className={`deckgo-pill ${rule.enabled ? "is-positive" : "is-muted"}`}>
                  {rule.enabled ? t("enabled") : t("disabled")}
                </span>
              </span>
            </span>
            <span className="deckgo-meta">
              {rule.entityType} · {rule.condition} {rule.threshold}
            </span>
            <span className="deckgo-meta">
              {t("action")}: {t(rule.action)} · {t("cooldown")}:{" "}
              {Math.round(rule.cooldownMs / 60_000)}
              {t("cooldownMinutes")} · {t("lastFired")}: {rule.lastFiredAt ?? t("never")}
            </span>
          </div>
          <div className="deck-ui-control-row-actions">
            <button
              className="deckgo-button deck-ui-alerts-button"
              type="button"
              onClick={() => props.onToggle(rule, !rule.enabled)}
            >
              {rule.enabled ? t("disabled") : t("enabled")}
            </button>
            <button
              className="deckgo-button deck-ui-alerts-button"
              type="button"
              onClick={() => props.onEdit(rule)}
            >
              {t("editRule")}
            </button>
            <button
              className="deckgo-button is-danger deck-ui-alerts-button"
              type="button"
              onClick={() => props.onDelete(rule)}
            >
              {t("deleteRule")}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
