import type { DeckGoSkillEntry } from "../../../api";
import { navigateToAgent } from "../../../deck-ui/panel-navigation";
import type { DeckUIState } from "../../../deck-ui/types";
import { useTranslations } from "../../../i18n/provider";

export function SkillAgentUsageSection(props: {
  skill: DeckGoSkillEntry;
  ui: Pick<DeckUIState, "setActivePanel">;
}) {
  const t = useTranslations("skills");
  const agentIds = props.skill.agentUsage.agentIds ?? [];

  return (
    <section className="skills-panel__section" id="agentUsage">
      <div className="skills-panel__section-head">
        <div>
          <p className="skills-panel__eyebrow">{t("readOnly")}</p>
          <h2>{t("sections.agentUsage")}</h2>
        </div>
        <span className="skills-panel__pill">{t("agentUsageCount", { count: agentIds.length })}</span>
      </div>
      {agentIds.length ? (
        <ul className="skills-panel__stack-list">
          {agentIds.map((agentId) => (
            <li className="skills-panel__usage-row" key={agentId}>
              <div>
                <strong>{agentId}</strong>
                <p className="skills-panel__note">{t("agentSkillModeWhitelist")}</p>
              </div>
              <button
                className="skills-panel__button"
                type="button"
                onClick={() => navigateToAgent(props.ui, agentId, "skills")}
              >
                {t("openAgentInAgents", { agentId })}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="skills-panel__note">{t("noAgentUsage")}</p>
      )}
    </section>
  );
}
