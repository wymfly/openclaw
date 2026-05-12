import type { DeckGoSkillEntry } from "../../../api";
import { navigateToAgent } from "../../../deck-ui/panel-navigation";
import type { DeckUIState } from "../../../deck-ui/types";
import { PanelPill, PanelSectionHeader, PanelSurface } from "../../../design-system/patterns";
import { useTranslations } from "../../../i18n/provider";

export function SkillAgentUsageSection(props: {
  skill: DeckGoSkillEntry;
  ui: Pick<DeckUIState, "setActivePanel">;
}) {
  const t = useTranslations("skills");
  const agentIds = props.skill.agentUsage.agentIds ?? [];

  return (
    <PanelSurface id="agentUsage">
      <PanelSectionHeader
        eyebrow={t("readOnly")}
        title={t("sections.agentUsage")}
        meta={<PanelPill>{t("agentUsageCount", { count: agentIds.length })}</PanelPill>}
      />
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
    </PanelSurface>
  );
}
