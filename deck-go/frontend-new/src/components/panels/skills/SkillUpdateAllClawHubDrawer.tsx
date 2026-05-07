import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function SkillUpdateAllClawHubDrawer(props: {
  open: boolean;
  managedSkills: DeckGoSkillEntry[];
  actionState: "idle" | "installing" | "updating";
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("skills");

  if (!props.open) {
    return null;
  }

  const affectedAgents = new Set(
    props.managedSkills.flatMap((skill) => skill.agentUsage.agentIds ?? []),
  ).size;

  return (
    <div className="skills-panel__modal-backdrop" role="presentation">
      <section className="skills-panel__modal" role="dialog" aria-modal="true" aria-label={t("updateAllManaged")}>
        <div className="skills-panel__modal-head">
          <div>
            <p className="skills-panel__eyebrow">L1</p>
            <h2>{t("updateAllManaged")}</h2>
          </div>
          <button className="skills-panel__button" type="button" onClick={props.onClose}>
            {t("close")}
          </button>
        </div>
        <p className="skills-panel__prose">{t("updateAllManagedCopy")}</p>
        <div className="skills-panel__impact-grid">
          <span>
            <strong>{props.managedSkills.length}</strong>
            {t("managedSkillsAffected")}
          </span>
          <span>
            <strong>{affectedAgents}</strong>
            {t("agentsAffected")}
          </span>
        </div>
        <p className="skills-panel__note">{t("updateAllLatestOnly")}</p>
        <div className="skills-panel__modal-actions">
          <button className="skills-panel__button" type="button" onClick={props.onClose}>
            {t("cancel")}
          </button>
          <button
            className="skills-panel__button is-primary"
            type="button"
            disabled={props.actionState !== "idle"}
            onClick={props.onConfirm}
          >
            {t("confirmUpdateAll")}
          </button>
        </div>
      </section>
    </div>
  );
}
