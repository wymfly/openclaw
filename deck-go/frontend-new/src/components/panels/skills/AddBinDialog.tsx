import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function AddBinDialog(props: {
  actionState: "idle" | "installing" | "updating";
  selectedSkill: DeckGoSkillEntry;
  onClose: () => void;
  onInstall: (installId: string) => void;
}) {
  const t = useTranslations("skills");
  const options = props.selectedSkill.installOptions ?? [];

  return (
    <div className="skills-panel__modal-backdrop" role="presentation">
      <section className="skills-panel__modal" role="dialog" aria-modal="true" aria-label={t("runInstallRecipe")}>
        <div className="skills-panel__modal-head">
          <div>
            <p className="skills-panel__eyebrow">{t("sourceActivation")}</p>
            <h2>{t("runInstallRecipe")}</h2>
          </div>
          <button className="skills-panel__button" type="button" onClick={props.onClose}>
            {t("close")}
          </button>
        </div>
        {options.length ? (
          <ul className="skills-panel__stack-list">
            {options.map((option) => (
              <li key={option.id} className="skills-panel__surface">
                <div className="skills-panel__section-head">
                  <div>
                    <strong>{option.label}</strong>
                    <p className="skills-panel__note">
                      {t("id")}: {option.id} · {t("bins")}:{" "}
                      {option.bins.length ? option.bins.join(", ") : t("notAvailable")}
                    </p>
                  </div>
                  <button
                    className="skills-panel__button is-primary"
                    type="button"
                    onClick={() => props.onInstall(option.id)}
                    disabled={props.actionState !== "idle"}
                  >
                    {props.actionState === "installing" ? t("installing") : option.label}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="skills-panel__note">{t("noInstallableSkills")}</p>
        )}
      </section>
    </div>
  );
}
