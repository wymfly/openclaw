import type { DeckGoWebhook } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import type { PanelState } from "./webhook-model";

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

  return (
    <article className="deckgo-card is-float deck-ui-webhooks-card">
      <div className="deckgo-card-header">
        <h2 className="deckgo-card-title">{t("title")}</h2>
        <button
          className="deckgo-button deck-ui-webhooks-button is-primary"
          type="button"
          onClick={props.onCreate}
        >
          {t("addWebhook")}
        </button>
      </div>
      <p className="deckgo-card-subtitle">{t("panelDescription")}</p>
      <div className="deckgo-card-body deckgo-dividerless deck-ui-webhooks-body">
        <div className="deckgo-pill-row deck-ui-webhooks-status-row">
          <span
            className={`deckgo-pill ${props.loadState === "ready" ? "is-positive" : "is-muted"}`}
          >
            {t("statusPrefix")} {t(props.loadState)}
          </span>
          <span className="deckgo-pill">
            {t("configuredCount", { count: props.webhooks.length })}
          </span>
        </div>
        <div className="deckgo-grid deckgo-grid-2 deck-ui-webhooks-stats">
          <ShellStat label={t("webhooks")} value={props.webhooks.length} />
          <ShellStat label={t("deliveries")} value={props.deliveriesCount} />
        </div>
        <div className="deckgo-actions deck-ui-webhooks-actions">
          <button
            className="deckgo-button deck-ui-webhooks-button"
            type="button"
            onClick={props.onRefresh}
          >
            {t("refreshWebhooks")}
          </button>
        </div>
        {props.error ? <p className="deckgo-note deck-ui-webhooks-error">{props.error}</p> : null}
        {props.webhooks.length === 0 ? (
          <p className="deckgo-note deck-ui-webhooks-empty">{t("noWebhooks")}</p>
        ) : (
          <ul className="deckgo-shell-list deck-ui-webhooks-list">
            {props.webhooks.map((webhook) => (
              <li key={webhook.id}>
                <button
                  type="button"
                  className={`deckgo-selectable-card deck-ui-webhooks-row ${
                    props.selectedWebhookId === webhook.id ? "is-selected" : ""
                  }`}
                  onClick={() => props.onSelect(webhook.id)}
                >
                  <strong>{webhook.name}</strong>
                  <div className="deckgo-meta">
                    {webhook.url} | {t("enabled")}: {webhook.enabled ? t("yes") : t("no")}
                  </div>
                  <div className="deckgo-meta">
                    {t("failures")}: {webhook.consecutiveFailures} | {t("lastStatus")}:{" "}
                    {webhook.lastStatus ?? t("notAvailable")}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
