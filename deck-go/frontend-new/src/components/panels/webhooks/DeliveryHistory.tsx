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
    <div className="webhooks-panel__surface">
      <div className="webhooks-panel__hero">
        <div>
          <p className="webhooks-panel__eyebrow">{t("deliveries")}</p>
          <strong>{t("deliveryCount", { count: props.deliveries.length })}</strong>
          <p className="webhooks-panel__note">{t("deliveriesDescription")}</p>
        </div>
        <div className="webhooks-panel__pill-row">
          <span className="webhooks-panel__pill">
            {t("failures")} {props.selectedWebhook.consecutiveFailures}
          </span>
          <button
            className="webhooks-panel__button is-primary"
            type="button"
            onClick={props.onTest}
            disabled={props.testing}
          >
            {props.testing ? t("testing") : t("testDelivery")}
          </button>
        </div>
      </div>
      {props.deliveries.length === 0 ? (
        <p className="webhooks-panel__note">{t("noDeliveries")}</p>
      ) : (
        <ul className="webhooks-panel__list">
          {props.deliveries.map((delivery) => {
            const detail = deliveryDetail(delivery);
            return (
              <li key={delivery.id}>
                <div className="webhooks-panel__delivery-row">
                  <div>
                    <div>
                      <strong>{delivery.eventType}</strong>
                      <p className="webhooks-panel__note">{delivery.createdAt}</p>
                    </div>
                    <div className="webhooks-panel__pill-row">
                      <span className="webhooks-panel__pill">
                        {t("statusCodeShort")} {delivery.statusCode ?? t("notAvailable")}
                      </span>
                      <span className="webhooks-panel__pill">
                        {t("duration")}{" "}
                        {delivery.durationMs != null
                          ? `${delivery.durationMs}ms`
                          : t("notAvailable")}
                      </span>
                      <span className="webhooks-panel__pill">
                        {t("attempt")} {delivery.attempt ?? 0}
                      </span>
                      {delivery.isRetry ? (
                        <span className="webhooks-panel__pill is-warn">{t("retrying")}</span>
                      ) : null}
                    </div>
                    {detail ? (
                      <p className="webhooks-panel__note">
                        {t("details")}: {detail}
                      </p>
                    ) : null}
                  </div>
                  <span className={`webhooks-panel__pill ${deliveryStatusClass(delivery)}`}>
                    {delivery.success ? t("success") : t("failed")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
