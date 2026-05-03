import type { DeckGoWebhook } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import type { PanelState } from "./webhook-model";
import { WebhookMetric } from "./WebhookMetric";

export function WebhookList(props: {
  webhooks: DeckGoWebhook[];
  deliveriesCount: number;
  error: string;
  loadState: PanelState;
  selectedWebhookId: string;
  onCreate: () => void;
  onRefresh: () => void;
  onSelect: (webhookId: string) => void;
}) {
  const t = useTranslations("webhooks");
  const enabledCount = props.webhooks.filter((webhook) => webhook.enabled).length;
  const failureCount = props.webhooks.reduce(
    (total, webhook) => total + webhook.consecutiveFailures,
    0,
  );

  return (
    <article className="webhooks-panel__card">
      <div className="webhooks-panel__card-head">
        <div>
          <p className="webhooks-panel__eyebrow">{t("webhooks")}</p>
          <h2 className="webhooks-panel__title">{t("title")}</h2>
        </div>
        <button
          className="webhooks-panel__button is-primary"
          type="button"
          onClick={props.onCreate}
        >
          {t("addWebhook")}
        </button>
      </div>
      <div className="webhooks-panel__body">
        <p className="webhooks-panel__description">{t("panelDescription")}</p>
        <div className="webhooks-panel__pill-row">
          <span
            className={`webhooks-panel__pill ${
              props.loadState === "ready" ? "is-good" : "is-warn"
            }`}
          >
            {t("statusPrefix")} {t(props.loadState)}
          </span>
          <span className="webhooks-panel__pill">
            {t("configuredCount", { count: props.webhooks.length })}
          </span>
        </div>
        <div className="webhooks-panel__metrics">
          <WebhookMetric label={t("webhooks")} value={props.webhooks.length} />
          <WebhookMetric label={t("enabled")} value={enabledCount} />
          <WebhookMetric label={t("failures")} value={failureCount} />
          <WebhookMetric label={t("deliveries")} value={props.deliveriesCount} />
        </div>
        <div className="webhooks-panel__actions">
          <button className="webhooks-panel__button" type="button" onClick={props.onRefresh}>
            {t("refreshWebhooks")}
          </button>
        </div>
        {props.error ? <p className="webhooks-panel__note is-danger">{props.error}</p> : null}
        {props.webhooks.length === 0 ? (
          <p className="webhooks-panel__note">{t("noWebhooks")}</p>
        ) : (
          <ul className="webhooks-panel__list">
            {props.webhooks.map((webhook) => (
              <li key={webhook.id}>
                <button
                  type="button"
                  className={`webhooks-panel__row ${
                    props.selectedWebhookId === webhook.id ? "is-selected" : ""
                  }`}
                  onClick={() => props.onSelect(webhook.id)}
                >
                  <div>
                    <strong>{webhook.name}</strong>
                    <p className="webhooks-panel__meta">{webhook.url}</p>
                    <p className="webhooks-panel__meta">
                      {t("failures")}: {webhook.consecutiveFailures} | {t("lastStatus")}:{" "}
                      {webhook.lastStatus ?? t("notAvailable")}
                    </p>
                  </div>
                  <span
                    className={`webhooks-panel__pill ${
                      webhook.enabled
                        ? webhook.consecutiveFailures > 0
                          ? "is-warn"
                          : "is-good"
                        : ""
                    }`}
                  >
                    {webhook.enabled ? t("enabled") : t("disabled")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
