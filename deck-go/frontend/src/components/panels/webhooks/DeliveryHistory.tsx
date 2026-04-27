import type { DeckGoWebhook, DeckGoWebhookDelivery } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { deliveryDetail, deliveryStatusClass } from "./webhook-model";

export function DeliveryHistory(props: {
  deliveries: DeckGoWebhookDelivery[];
  selectedWebhook: DeckGoWebhook;
  testing: boolean;
  onTest: () => void;
}) {
  const t = useTranslations("webhooks");

  return (
    <div className="deckgo-surface-tile deck-ui-webhooks-surface">
      <div className="deckgo-panel-hero-strip deck-ui-webhooks-hero">
        <div>
          <p className="deckgo-kicker">{t("deliveries")}</p>
          <strong>{t("deliveryCount", { count: props.deliveries.length })}</strong>
          <p className="deckgo-note">{t("deliveriesDescription")}</p>
        </div>
        <div className="deckgo-pill-row">
          <span className="deckgo-pill">
            {t("failures")} {props.selectedWebhook.consecutiveFailures}
          </span>
          <button
            className="deckgo-button deck-ui-webhooks-button is-primary"
            type="button"
            onClick={props.onTest}
            disabled={props.testing}
          >
            {props.testing ? t("testing") : t("testDelivery")}
          </button>
        </div>
      </div>
      {props.deliveries.length === 0 ? (
        <p className="deckgo-note">{t("noDeliveries")}</p>
      ) : (
        <ul className="deckgo-shell-list deck-ui-webhooks-delivery-list">
          {props.deliveries.map((delivery) => {
            const detail = deliveryDetail(delivery);
            return (
              <li key={delivery.id}>
                <div className="deckgo-selectable-card deck-ui-webhooks-delivery-row">
                  <div className="deckgo-panel-hero-strip deck-ui-webhooks-hero">
                    <div>
                      <strong>{delivery.eventType}</strong>
                      <p className="deckgo-note">{delivery.createdAt}</p>
                    </div>
                    <span className={`deckgo-pill ${deliveryStatusClass(delivery)}`}>
                      {delivery.success ? t("success") : t("failed")}
                    </span>
                  </div>
                  <div className="deckgo-pill-row deck-ui-webhooks-delivery-meta">
                    <span className="deckgo-pill">
                      {t("statusCodeShort")} {delivery.statusCode ?? t("notAvailable")}
                    </span>
                    <span className="deckgo-pill">
                      {t("duration")}{" "}
                      {delivery.durationMs != null ? `${delivery.durationMs}ms` : t("notAvailable")}
                    </span>
                    <span className="deckgo-pill">
                      {t("attempt")} {delivery.attempt ?? 0}
                    </span>
                    {delivery.isRetry ? (
                      <span className="deckgo-pill is-warning">{t("retrying")}</span>
                    ) : null}
                  </div>
                  {detail ? (
                    <p className="deckgo-note deck-ui-webhooks-delivery-detail">
                      {t("details")}: {detail}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
