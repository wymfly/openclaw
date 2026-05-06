import type { DeckGoAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function FiredAlertsList(props: { rule: DeckGoAlertRule }) {
  const t = useTranslations("alerts");
  const firedAt = formatDate(props.rule.lastFiredAt, t("never"));

  return (
    <div className="alerts-panel__fires">
      <div className="alerts-panel__unsupported">
        <span className="alerts-panel__info-icon" aria-hidden="true">
          i
        </span>
        <div>
          <strong>{t("firedHistoryUnavailableTitle")}</strong>
          <p>{t("firedHistoryUnavailableDescription")}</p>
        </div>
      </div>

      <article className="alerts-panel__timeline-row">
        <span className="alerts-panel__event-pill">{t("lastFired")}</span>
        <div>
          <strong>{props.rule.name}</strong>
          <p>
            {t("triggerDetails")}: {props.rule.entityType} · {props.rule.condition}{" "}
            {props.rule.threshold}
          </p>
          <p>
            {t("lastFired")}: {firedAt}
          </p>
        </div>
      </article>
    </div>
  );
}
