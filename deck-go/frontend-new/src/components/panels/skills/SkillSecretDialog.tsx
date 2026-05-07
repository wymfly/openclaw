import { useEffect, useState } from "react";
import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function SkillSecretDialog(props: {
  open: boolean;
  actionState: "idle" | "installing" | "updating";
  skill: DeckGoSkillEntry | null;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations("skills");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!props.open) {
      setDraft("");
    }
  }, [props.open]);

  if (!props.open || !props.skill) {
    return null;
  }

  return (
    <div className="skills-panel__modal-backdrop" role="presentation">
      <section className="skills-panel__modal" role="dialog" aria-modal="true" aria-label={t("updateApiKey")}>
        <div className="skills-panel__modal-head">
          <div>
            <p className="skills-panel__eyebrow">{t("apiKey")}</p>
            <h2>{t("updateApiKey")}</h2>
          </div>
          <button className="skills-panel__button" type="button" onClick={props.onClose}>
            {t("close")}
          </button>
        </div>
        <p className="skills-panel__note">
          {props.skill.apiKeyConfigured ? t("apiKeyConfigured") : t("apiKeyNotConfigured")}
        </p>
        <label className="skills-panel__field">
          <span>{t("newApiKey")}</span>
          <input
            className="skills-panel__input"
            aria-label={t("newApiKey")}
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <p className="skills-panel__note">{t("apiKeyHintUnsupported")}</p>
        <div className="skills-panel__modal-actions">
          <button
            className="skills-panel__button is-primary"
            type="button"
            disabled={!draft || props.actionState !== "idle"}
            onClick={() => {
              props.onSave(draft);
              setDraft("");
            }}
          >
            {t("saveApiKey")}
          </button>
          <button
            className="skills-panel__button"
            type="button"
            disabled={!props.skill.apiKeyConfigured || props.actionState !== "idle"}
            onClick={() => {
              props.onClear();
              setDraft("");
            }}
          >
            {t("clearApiKey")}
          </button>
          <button className="skills-panel__button" type="button" disabled title="gateway-rpc-missing">
            {t("rotateApiKey")} · gateway-rpc-missing
          </button>
        </div>
      </section>
    </div>
  );
}
