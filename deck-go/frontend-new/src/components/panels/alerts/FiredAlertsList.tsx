import type { DeckGoAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function FiredAlertsList(props: { rules: DeckGoAlertRule[] }) {
  const t = useTranslations("alerts");
  const firedSnapshots = props.rules.filter((rule) => rule.lastFiredAt);

  return (
    <section className="alerts-panel__card">
      <div className="alerts-panel__card-head">
        <div>
          <h3 className="alerts-panel__card-title">{t("firedAlerts")}</h3>
          <p className="alerts-panel__meta">{t("firedHistoryUnavailableDescription")}</p>
        </div>
        <span className="alerts-panel__pill is-warning">{t("unavailable")}</span>
      </div>

      <div className="alerts-panel__body alerts-panel__fired-list">
        <div className="alerts-panel__surface">
          <strong>{t("firedHistoryUnavailableTitle")}</strong>
          <p className="alerts-panel__note">{t("firedFallbackNote")}</p>
        </div>

        {firedSnapshots.length === 0 ? (
          <p className="alerts-panel__empty">{t("noFiredAlerts")}</p>
        ) : (
          firedSnapshots.map((rule) => (
            <article className="alerts-panel__fired-row" key={rule.id}>
              <div className="alerts-panel__row-head">
                <strong>{rule.name}</strong>
                <span className="alerts-panel__pill">{t(rule.action)}</span>
              </div>
              <p className="alerts-panel__meta">
                {t("triggerDetails")}: {rule.entityType} · {rule.condition} {rule.threshold}
              </p>
              <p className="alerts-panel__meta">
                {t("lastFired")}: {rule.lastFiredAt}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
