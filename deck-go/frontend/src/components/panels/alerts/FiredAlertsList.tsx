import type { DeckGoAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function FiredAlertsList(props: { rules: DeckGoAlertRule[] }) {
  const t = useTranslations("alerts");
  const firedSnapshots = props.rules.filter((rule) => rule.lastFiredAt);

  return (
    <div className="deck-ui-control-stack deck-ui-alerts-fired">
      <div className="deck-ui-control-unavailable">
        <span className="deckgo-pill is-warning">{t("unavailable")}</span>
        <div>
          <strong>{t("firedHistoryUnavailableTitle")}</strong>
          <p>{t("firedHistoryUnavailableDescription")}</p>
        </div>
      </div>

      {firedSnapshots.length === 0 ? (
        <p className="deck-ui-control-empty">{t("noFiredAlerts")}</p>
      ) : (
        <div className="deck-ui-control-list deck-ui-alerts-list">
          {firedSnapshots.map((rule) => (
            <article className="deck-ui-control-row deck-ui-alerts-row" key={rule.id}>
              <div className="deck-ui-control-row-main">
                <span className="deck-ui-control-row-header">
                  <strong>{rule.name}</strong>
                  <span className="deckgo-pill">{rule.action}</span>
                </span>
                <span className="deckgo-meta">
                  {t("triggerDetails")}: {rule.entityType} · {rule.condition} {rule.threshold}
                </span>
                <span className="deckgo-meta">
                  {t("lastFired")}: {rule.lastFiredAt}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
