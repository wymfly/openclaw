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
    <div className="skills-panel__surface">
      <p className="skills-panel__eyebrow">{t("installOptions")}</p>
      <ul className="skills-panel__list">
        {props.selectedSkill.installOptions.map((option) => (
          <li key={option.id}>
            <div className="skills-panel__row">
              <div className="skills-panel__row-head">
                <strong>{option.label}</strong>
                <button
                  className="skills-panel__button"
                  type="button"
                  onClick={() => props.onInstall(option.id)}
                  disabled={props.actionState !== "idle"}
                >
                  {props.actionState === "installing" ? t("installing") : t("install")}
                </button>
              </div>
              <div className="skills-panel__meta">
                {t("id")}: {option.id} | {t("bins")}:{" "}
                {option.bins.length > 0 ? option.bins.join(", ") : t("notAvailable")}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
