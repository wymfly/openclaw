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
    <div className="skills-panel__surface">
      <div className="skills-panel__row-head">
        <div>
          <p className="skills-panel__eyebrow">{t("agentSkillMatrix")}</p>
          <p className="skills-panel__note">{t("agentSkillMatrixDescription")}</p>
        </div>
        <button
          className="skills-panel__button"
          type="button"
          onClick={props.onRefresh}
          disabled={props.matrixState === "loading"}
        >
          {props.matrixState === "loading" ? t("loadingMatrix") : t("refreshMatrix")}
        </button>
      </div>
      {props.matrixError ? (
        <p className="skills-panel__note is-danger">{props.matrixError}</p>
      ) : null}
      {props.agents.length && props.skills.length ? (
        <div className="skills-panel__matrix-shell">
          <table className="skills-panel__matrix">
            <thead>
              <tr>
                <th>{t("skill").toLowerCase()}</th>
                {props.agents.map((agent) => (
                  <th key={agent.id}>
                    <button
                      className="skills-panel__button"
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
                          <span className="skills-panel__pill">{t("notAvailable")}</span>
                        ) : mode === "all" ? (
                          <span className="skills-panel__pill is-good">{t("allSkills")}</span>
                        ) : (
                          <button
                            className={`skills-panel__pill ${assigned ? "is-good" : ""}`}
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
        <p className="skills-panel__note">{t("noAgentSkillMatrix")}</p>
      )}
      {props.matrixActionResult ? (
        <JsonDetails title={t("lastMatrixAction")} payload={props.matrixActionResult} />
      ) : null}
    </div>
  );
}
