import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import { SkillMetric } from "./SkillMetric";

export function SkillInfoTab(props: { selectedSkill: DeckGoSkillEntry }) {
  const t = useTranslations("skills");

  return (
    <>
      <div className="skills-panel__hero">
        <div>
          <p className="skills-panel__eyebrow">{t("skill")}</p>
          <strong>{props.selectedSkill.name}</strong>
          <p className="skills-panel__note">
            {props.selectedSkill.description || t("noDescription")}
          </p>
        </div>
        <div className="skills-panel__pill-row">
          <span className="skills-panel__pill">
            {t("source")}: {props.selectedSkill.source}
          </span>
          <span
            className={`skills-panel__pill ${
              props.selectedSkill.status === "ready"
                ? "is-good"
                : props.selectedSkill.status === "needs-setup"
                  ? "is-warn"
                  : ""
            }`}
          >
            {t("status")}: {props.selectedSkill.status}
          </span>
        </div>
      </div>
      <div className="skills-panel__detail-metrics">
        <SkillMetric
          label={t("enabledLower")}
          value={props.selectedSkill.enabled ? t("yes") : t("no")}
        />
        <SkillMetric
          label={t("primaryEnv")}
          value={props.selectedSkill.primaryEnv || t("notAvailable")}
        />
      </div>
      {props.selectedSkill.missingRequirements?.length ? (
        <div className="skills-panel__surface">
          <p className="skills-panel__eyebrow">{t("missingRequirements")}</p>
          <div className="skills-panel__pill-row">
            {props.selectedSkill.missingRequirements.map((requirement) => (
              <span className="skills-panel__pill is-warn" key={requirement}>
                {requirement}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <JsonDetails title={t("skillPayload")} payload={props.selectedSkill} />
    </>
  );
}
