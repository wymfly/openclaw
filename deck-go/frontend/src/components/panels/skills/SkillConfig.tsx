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
    <div className="deckgo-surface-tile deck-ui-skills-surface">
      <p className="deckgo-surface-label">{t("skillConfiguration")}</p>
      <label className="deckgo-label">
        <span>{t("apiKey")}</span>
        <input
          className="deckgo-input deck-ui-skills-input"
          type="password"
          value={props.apiKeyDraft}
          onChange={(event) => props.onApiKeyChange(event.target.value)}
          placeholder={props.selectedSkill.primaryEnv || "api key"}
        />
      </label>
      <label className="deckgo-label">
        <span>{t("environmentJson")}</span>
        <textarea
          aria-label="skill env json"
          className="deckgo-textarea deck-ui-skills-textarea"
          rows={8}
          value={props.envDraft}
          onChange={(event) => props.onEnvChange(event.target.value)}
        />
      </label>
      <div className="deckgo-actions deck-ui-skills-actions">
        <button
          className="deckgo-button is-primary deck-ui-skills-button"
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
