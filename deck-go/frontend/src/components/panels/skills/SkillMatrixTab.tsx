import type { DeckGoAgentSkillsResponse, DeckGoAgentSummary, DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import { normalizeAgentSkillMode, type PanelState } from "./skill-model";

export function SkillMatrixTab(props: {
  agents: DeckGoAgentSummary[];
  agentSkillsByAgent: Record<string, DeckGoAgentSkillsResponse>;
  matrixActionKey: string;
  matrixActionResult: unknown;
  matrixError: string;
  matrixState: PanelState;
  skills: DeckGoSkillEntry[];
  onNavigateAgent: (agentId: string) => void;
  onRefresh: () => void;
  onToggle: (agent: DeckGoAgentSummary, skill: DeckGoSkillEntry) => void;
}) {
  const t = useTranslations("skills");

  return (
    <div className="deckgo-surface-tile deck-ui-skills-surface">
      <p className="deckgo-surface-label">{t("agentSkillMatrix")}</p>
      <p className="deckgo-note">{t("agentSkillMatrixDescription")}</p>
      <div className="deckgo-actions deck-ui-skills-actions deck-ui-skills-actions-offset">
        <button
          className="deckgo-button deck-ui-skills-button"
          type="button"
          onClick={props.onRefresh}
          disabled={props.matrixState === "loading"}
        >
          {props.matrixState === "loading" ? t("loadingMatrix") : t("refreshMatrix")}
        </button>
      </div>
      {props.matrixError ? <p className="deckgo-note">{props.matrixError}</p> : null}
      {props.agents.length && props.skills.length ? (
        <div className="deck-ui-skills-table-shell">
          <table className="deckgo-table">
            <thead>
              <tr>
                <th>{t("skill").toLowerCase()}</th>
                {props.agents.map((agent) => (
                  <th key={agent.id}>
                    <button
                      className="deckgo-button deck-ui-skills-button"
                      type="button"
                      title={agent.id}
                      onClick={() => props.onNavigateAgent(agent.id)}
                    >
                      {agent.name || agent.id}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.skills.map((skill) => (
                <tr key={skill.key}>
                  <td>{skill.name || skill.key}</td>
                  {props.agents.map((agent) => {
                    const config = props.agentSkillsByAgent[agent.id];
                    const mode = normalizeAgentSkillMode(config?.mode);
                    const assigned = Boolean(config?.skills.includes(skill.key));
                    const actionKey = `${agent.id}:${skill.key}`;
                    return (
                      <td key={agent.id}>
                        {!config ? (
                          <span className="deckgo-pill is-muted">{t("notAvailable")}</span>
                        ) : mode === "all" ? (
                          <span className="deckgo-pill is-positive">{t("allSkills")}</span>
                        ) : (
                          <button
                            className={`deckgo-pill ${assigned ? "is-positive" : "is-muted"}`}
                            type="button"
                            aria-label={t(assigned ? "removeSkillForAgent" : "addSkillForAgent", {
                              agent: agent.id,
                              skill: skill.key,
                            })}
                            disabled={Boolean(props.matrixActionKey)}
                            onClick={() => props.onToggle(agent, skill)}
                          >
                            {props.matrixActionKey === actionKey
                              ? t("updating")
                              : assigned
                                ? t("included")
                                : t("excluded")}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="deckgo-note deck-ui-skills-empty">{t("noAgentSkillMatrix")}</p>
      )}
      {props.matrixActionResult ? (
        <JsonDetails title={t("lastMatrixAction")} payload={props.matrixActionResult} />
      ) : null}
    </div>
  );
}
