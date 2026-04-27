import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

export function SkillInfoTab(props: { selectedSkill: DeckGoSkillEntry }) {
  const t = useTranslations("skills");

  return (
    <>
      <div className="deckgo-panel-hero-strip deck-ui-skills-hero">
        <div>
          <p className="deckgo-kicker">{t("skill")}</p>
          <strong>{props.selectedSkill.name}</strong>
          <p className="deckgo-note">{props.selectedSkill.description || t("noDescription")}</p>
        </div>
        <div className="deckgo-pill-row">
          <span className="deckgo-pill">
            {t("source")}: {props.selectedSkill.source}
          </span>
          <span className="deckgo-pill">
            {t("status")}: {props.selectedSkill.status}
          </span>
        </div>
      </div>
      <div className="deckgo-grid deckgo-grid-2 deck-ui-skills-detail-stats">
        <ShellStat
          label={t("enabledLower")}
          value={props.selectedSkill.enabled ? t("yes") : t("no")}
        />
        <ShellStat
          label={t("primaryEnv")}
          value={props.selectedSkill.primaryEnv || t("notAvailable")}
        />
      </div>
      {props.selectedSkill.missingRequirements?.length ? (
        <JsonDetails
          title={t("missingRequirements")}
          payload={props.selectedSkill.missingRequirements}
        />
      ) : null}
      <JsonDetails title={t("skillPayload")} payload={props.selectedSkill} />
    </>
  );
}
