import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function InstallSkillDialog(props: {
  actionState: "idle" | "installing" | "updating";
  selectedSkill: DeckGoSkillEntry;
  onInstall: (installId: string) => void;
}) {
  const t = useTranslations("skills");

  if (!props.selectedSkill.installOptions?.length) {
    return null;
  }

  return (
    <div className="deckgo-surface-tile deck-ui-skills-surface">
      <p className="deckgo-surface-label">{t("installOptions")}</p>
      <ul className="deckgo-shell-list deck-ui-skills-list">
        {props.selectedSkill.installOptions.map((option) => (
          <li key={option.id}>
            <div className="deckgo-selectable-card deck-ui-skills-row">
              <strong>{option.label}</strong>
              <div className="deckgo-meta">
                {t("id")}: {option.id} | {t("bins")}:{" "}
                {option.bins.length > 0 ? option.bins.join(", ") : t("notAvailable")}
              </div>
              <div className="deckgo-actions deck-ui-skills-actions deck-ui-skills-actions-offset">
                <button
                  className="deckgo-button deck-ui-skills-button"
                  type="button"
                  onClick={() => props.onInstall(option.id)}
                  disabled={props.actionState !== "idle"}
                >
                  {props.actionState === "installing" ? t("installing") : t("install")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
