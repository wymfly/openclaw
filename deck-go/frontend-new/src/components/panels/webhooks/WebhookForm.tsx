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
      className="webhooks-panel__surface webhooks-panel__form"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <div className="webhooks-panel__hero">
        <div>
          <p className="webhooks-panel__eyebrow">{t("configuration")}</p>
          <strong>{props.editing ? t("editWebhook") : t("addWebhook")}</strong>
          <p className="webhooks-panel__note">{t("formDescription")}</p>
        </div>
        <span className="webhooks-panel__pill">
          {props.editing ? t("editMode") : t("createMode")}
        </span>
      </div>
      <div className="webhooks-panel__field-grid">
        <label className="webhooks-panel__field">
          <span>{t("name")}</span>
          <input
            aria-label="webhook name"
            className="webhooks-panel__input"
            value={props.draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder={t("namePlaceholder")}
            required
          />
        </label>
        <label className="webhooks-panel__field">
          <span>{t("url")}</span>
          <input
            aria-label="webhook url"
            className="webhooks-panel__input"
            type="url"
            value={props.draft.url}
            onChange={(event) => updateDraft({ url: event.target.value })}
            placeholder="https://example.com/webhook"
            required
          />
        </label>
        <label className="webhooks-panel__field">
          <span>{t("secret")}</span>
          <input
            aria-label="webhook secret"
            className="webhooks-panel__input"
            type="password"
            value={props.draft.secret}
            onChange={(event) => updateDraft({ secret: event.target.value })}
            placeholder={t("optionalSecret")}
          />
        </label>
        <label className="webhooks-panel__field">
          <span>{t("events")}</span>
          <input
            aria-label="webhook events"
            className="webhooks-panel__input"
            value={props.draft.events}
            onChange={(event) => updateDraft({ events: event.target.value })}
            placeholder={t("eventsPlaceholder")}
          />
        </label>
      </div>
      <div className="webhooks-panel__pill-row">
        {AVAILABLE_WEBHOOK_EVENTS.map((eventName) => (
          <button
            aria-label={`toggle webhook event ${eventName}`}
            className={`webhooks-panel__button ${
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
      <label className="webhooks-panel__checkbox">
        <input
          type="checkbox"
          checked={props.draft.enabled}
          onChange={(event) => updateDraft({ enabled: event.target.checked })}
        />
        <span>{t("enabledToggle")}</span>
      </label>
      <div className="webhooks-panel__actions">
        <button className="webhooks-panel__button is-primary" type="submit" disabled={props.saving}>
          {props.saving ? t("saving") : props.editing ? t("saveSelected") : t("createWebhook")}
        </button>
        <button className="webhooks-panel__button" type="button" onClick={props.onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
