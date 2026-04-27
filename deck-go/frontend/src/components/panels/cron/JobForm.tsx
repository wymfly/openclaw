import type { Dispatch, SetStateAction } from "react";
import type { DeckGoCronJob } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import {
  CRON_TEMPLATES,
  type CronActionState,
  type CronDraft,
  type CronPayloadKind,
  type CronScheduleKind,
} from "./cron-model";

export function JobForm(props: {
  draft: CronDraft;
  selectedJob: DeckGoCronJob | null;
  actionState: CronActionState;
  setDraft: Dispatch<SetStateAction<CronDraft>>;
  onCreate: () => void;
  onLoadSelected: () => void;
  onUpdateSelected: () => void;
}) {
  const t = useTranslations("cron");

  return (
    <div className="deckgo-surface-tile deck-ui-cron-surface">
      <p className="deckgo-surface-label">{t("configuration")}</p>
      <div className="deckgo-pill-row deck-ui-cron-template-row">
        {CRON_TEMPLATES.map((template) => (
          <button
            key={template.key}
            className="deckgo-button deck-ui-cron-button"
            type="button"
            onClick={() =>
              props.setDraft((current) => ({
                ...current,
                scheduleKind: "cron",
                scheduleValue: template.expr,
              }))
            }
          >
            {t(`templates.${template.key}`)}
          </button>
        ))}
      </div>
      <div className="deckgo-grid deckgo-grid-2 deck-ui-cron-form-grid">
        <input
          aria-label={t("name")}
          className="deckgo-input deck-ui-cron-input"
          value={props.draft.name}
          onChange={(event) =>
            props.setDraft((current) => ({ ...current, name: event.target.value }))
          }
          placeholder={t("name")}
        />
        <select
          aria-label={t("schedule")}
          className="deckgo-input deck-ui-cron-input"
          value={props.draft.scheduleKind}
          onChange={(event) =>
            props.setDraft((current) => ({
              ...current,
              scheduleKind: event.target.value as CronScheduleKind,
            }))
          }
        >
          <option value="cron">{t("scheduleKinds.cron")}</option>
          <option value="every">{t("scheduleKinds.every")}</option>
          <option value="at">{t("scheduleKinds.at")}</option>
        </select>
        <input
          aria-label={t("scheduleValue")}
          className="deckgo-input deck-ui-cron-input"
          value={props.draft.scheduleValue}
          onChange={(event) =>
            props.setDraft((current) => ({ ...current, scheduleValue: event.target.value }))
          }
          placeholder={t("schedulePlaceholder")}
        />
        <select
          aria-label={t("sessionTarget")}
          className="deckgo-input deck-ui-cron-input"
          value={props.draft.sessionTarget}
          onChange={(event) =>
            props.setDraft((current) => ({ ...current, sessionTarget: event.target.value }))
          }
        >
          <option value="main">{t("main")}</option>
          <option value="isolated">{t("isolated")}</option>
          <option value="current">{t("current")}</option>
        </select>
        <select
          aria-label={t("wakeMode")}
          className="deckgo-input deck-ui-cron-input"
          value={props.draft.wakeMode}
          onChange={(event) =>
            props.setDraft((current) => ({ ...current, wakeMode: event.target.value }))
          }
        >
          <option value="now">{t("now")}</option>
          <option value="next-heartbeat">{t("nextHeartbeat")}</option>
        </select>
        <select
          aria-label={t("payloadType")}
          className="deckgo-input deck-ui-cron-input"
          value={props.draft.payloadKind}
          onChange={(event) => {
            const payloadKind = event.target.value as CronPayloadKind;
            props.setDraft((current) => ({
              ...current,
              payloadKind,
              sessionTarget: payloadKind === "agentTurn" ? "isolated" : "main",
            }));
          }}
        >
          <option value="systemEvent">{t("payloadKinds.systemEvent")}</option>
          <option value="agentTurn">{t("payloadKinds.agentTurn")}</option>
        </select>
        <input
          className="deckgo-input deck-ui-cron-input"
          value={props.draft.agentId}
          onChange={(event) =>
            props.setDraft((current) => ({ ...current, agentId: event.target.value }))
          }
          placeholder={t("agentId")}
        />
      </div>
      <textarea
        className="deckgo-input deck-ui-cron-input deck-ui-cron-textarea"
        value={props.draft.payloadValue}
        onChange={(event) =>
          props.setDraft((current) => ({ ...current, payloadValue: event.target.value }))
        }
        placeholder={
          props.draft.payloadKind === "agentTurn"
            ? t("agentMessagePlaceholder")
            : t("eventNamePlaceholder")
        }
        rows={3}
      />
      <textarea
        className="deckgo-input deck-ui-cron-input deck-ui-cron-textarea"
        value={props.draft.description}
        onChange={(event) =>
          props.setDraft((current) => ({ ...current, description: event.target.value }))
        }
        placeholder={t("description")}
        rows={2}
      />
      <label className="deckgo-label">
        <span>{t("enabled")}</span>
        <input
          type="checkbox"
          checked={props.draft.enabled}
          onChange={(event) =>
            props.setDraft((current) => ({ ...current, enabled: event.target.checked }))
          }
        />
      </label>
      <div className="deckgo-actions deck-ui-cron-actions deck-ui-cron-actions-offset">
        <button
          className="deckgo-button deck-ui-cron-button is-primary"
          type="button"
          onClick={props.onCreate}
          disabled={props.actionState !== "idle"}
        >
          {props.actionState === "creating" ? t("creating") : t("createJob")}
        </button>
        <button
          className="deckgo-button deck-ui-cron-button"
          type="button"
          onClick={props.onLoadSelected}
          disabled={!props.selectedJob || props.actionState !== "idle"}
        >
          {t("loadSelected")}
        </button>
        <button
          className="deckgo-button deck-ui-cron-button"
          type="button"
          onClick={props.onUpdateSelected}
          disabled={!props.selectedJob || props.actionState !== "idle"}
        >
          {props.actionState === "updating" ? t("saving") : t("saveSelected")}
        </button>
      </div>
    </div>
  );
}
