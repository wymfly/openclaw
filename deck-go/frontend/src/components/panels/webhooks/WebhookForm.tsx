import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "../../../i18n/provider";
import {
  AVAILABLE_WEBHOOK_EVENTS,
  formatWebhookEvents,
  parseWebhookEvents,
  type WebhookDraft,
} from "./webhook-model";

export function WebhookForm(props: {
  draft: WebhookDraft;
  editing: boolean;
  saving: boolean;
  onCancel: () => void;
  onChange: Dispatch<SetStateAction<WebhookDraft>>;
  onSave: () => void;
}) {
  const t = useTranslations("webhooks");
  const draftEvents = parseWebhookEvents(props.draft.events);

  const updateDraft = (patch: Partial<WebhookDraft>) => {
    props.onChange((current) => ({ ...current, ...patch }));
  };

  const toggleDraftEvent = (eventName: string) => {
    props.onChange((current) => {
      const currentEvents = parseWebhookEvents(current.events);
      const nextEvents = currentEvents.includes(eventName)
        ? currentEvents.filter((event) => event !== eventName)
        : [...currentEvents, eventName];
      return { ...current, events: formatWebhookEvents(nextEvents) };
    });
  };

  return (
    <form
      className="deckgo-surface-tile deck-ui-webhooks-surface"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <div className="deckgo-panel-hero-strip deck-ui-webhooks-hero">
        <div>
          <p className="deckgo-kicker">{t("configuration")}</p>
          <strong>{props.editing ? t("editWebhook") : t("addWebhook")}</strong>
          <p className="deckgo-note">{t("formDescription")}</p>
        </div>
        <span className="deckgo-pill">{props.editing ? t("editMode") : t("createMode")}</span>
      </div>
      <div className="deckgo-grid deckgo-grid-2 deck-ui-webhooks-form-grid">
        <label className="deckgo-label">
          <span>{t("name")}</span>
          <input
            aria-label="webhook name"
            className="deckgo-input deck-ui-webhooks-input"
            value={props.draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder={t("namePlaceholder")}
            required
          />
        </label>
        <label className="deckgo-label">
          <span>{t("url")}</span>
          <input
            aria-label="webhook url"
            className="deckgo-input deck-ui-webhooks-input"
            type="url"
            value={props.draft.url}
            onChange={(event) => updateDraft({ url: event.target.value })}
            placeholder="https://example.com/webhook"
            required
          />
        </label>
        <label className="deckgo-label">
          <span>{t("secret")}</span>
          <input
            aria-label="webhook secret"
            className="deckgo-input deck-ui-webhooks-input"
            type="password"
            value={props.draft.secret}
            onChange={(event) => updateDraft({ secret: event.target.value })}
            placeholder={t("optionalSecret")}
          />
        </label>
        <label className="deckgo-label">
          <span>{t("events")}</span>
          <input
            aria-label="webhook events"
            className="deckgo-input deck-ui-webhooks-input"
            value={props.draft.events}
            onChange={(event) => updateDraft({ events: event.target.value })}
            placeholder={t("eventsPlaceholder")}
          />
        </label>
      </div>
      <div className="deckgo-pill-row deck-ui-webhooks-event-row">
        {AVAILABLE_WEBHOOK_EVENTS.map((eventName) => (
          <button
            aria-label={`toggle webhook event ${eventName}`}
            className={`deckgo-button deck-ui-webhooks-button ${
              draftEvents.includes(eventName) ? "is-primary" : ""
            }`}
            key={eventName}
            type="button"
            onClick={() => toggleDraftEvent(eventName)}
          >
            {eventName}
          </button>
        ))}
      </div>
      <label className="deckgo-label">
        <span>{t("enabledToggle")}</span>
        <input
          type="checkbox"
          checked={props.draft.enabled}
          onChange={(event) => updateDraft({ enabled: event.target.checked })}
        />
      </label>
      <div className="deckgo-actions deck-ui-webhooks-actions deck-ui-webhooks-actions-offset">
        <button
          className="deckgo-button deck-ui-webhooks-button is-primary"
          type="submit"
          disabled={props.saving}
        >
          {props.saving ? t("saving") : props.editing ? t("saveSelected") : t("createWebhook")}
        </button>
        <button
          className="deckgo-button deck-ui-webhooks-button"
          type="button"
          onClick={props.onCancel}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
