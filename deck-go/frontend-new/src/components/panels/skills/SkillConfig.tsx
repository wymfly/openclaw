import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function SkillConfig(props: {
  actionState: "idle" | "installing" | "updating";
  apiKeyDraft: string;
  envDraft: string;
  selectedSkill: DeckGoSkillEntry;
  onApiKeyChange: (value: string) => void;
  onEnvChange: (value: string) => void;
  onSave: () => void;
}) {
  const t = useTranslations("skills");

  return (
    <div className="skills-panel__surface">
      <p className="skills-panel__eyebrow">{t("skillConfiguration")}</p>
      <label className="skills-panel__field">
        <span>{t("apiKey")}</span>
        <input
          className="skills-panel__input"
          type="password"
          value={props.apiKeyDraft}
          onChange={(event) => props.onApiKeyChange(event.target.value)}
          placeholder={props.selectedSkill.primaryEnv || "api key"}
        />
      </label>
      <label className="skills-panel__field">
        <span>{t("environmentJson")}</span>
        <textarea
          aria-label="skill env json"
          className="skills-panel__textarea"
          rows={8}
          value={props.envDraft}
          onChange={(event) => props.onEnvChange(event.target.value)}
        />
      </label>
      <div className="skills-panel__actions">
        <button
          className="skills-panel__button is-primary"
          type="button"
          onClick={props.onSave}
          disabled={props.actionState !== "idle"}
        >
          {props.actionState === "updating" ? t("saving") : t("saveConfig")}
        </button>
      </div>
    </div>
  );
}
