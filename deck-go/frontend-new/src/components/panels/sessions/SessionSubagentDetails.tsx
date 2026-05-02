import type { DeckGoSubagentsLineageResponse } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export type SessionRelationshipMeta = {
  childSessions?: string[];
  parentSessionKey?: string;
  subagentControlScope?: string;
  subagentRole?: string;
  spawnedWorkspaceDir?: string;
};

type SessionSubagentDetailsProps = {
  childSessionKeys: string[];
  isSubagent: boolean;
  lineage: DeckGoSubagentsLineageResponse | null;
  lineageState: "idle" | "loading" | "ready";
  onOpenSubagents: () => void;
  onSelectSessionKey: (sessionKey: string) => void;
  parentSessionKey: string;
  relationships: SessionRelationshipMeta | null;
};

export function SessionSubagentDetails(props: SessionSubagentDetailsProps) {
  const t = useTranslations("sessions");

  return (
    <>
      {props.isSubagent ? (
        <div className="deckgo-surface-tile deck-ui-sessions-surface deck-ui-sessions-subagent">
          <p className="deckgo-surface-label">{t("subagentLineage")}</p>
          <div className="deckgo-actions deck-ui-sessions-actions deck-ui-sessions-actions-offset">
            <button
              className="deckgo-button deck-ui-sessions-button"
              type="button"
              onClick={props.onOpenSubagents}
            >
              {t("openSubagentsPanel")}
            </button>
          </div>
          {props.lineage ? (
            <>
              <div className="deckgo-meta">
                {t("lineageRoot", {
                  agent: props.lineage.root.agentName ?? props.lineage.root.agentId,
                  sessionKey: props.lineage.root.sessionKey,
                })}
              </div>
              {props.lineage.nodes.length > 0 ? (
                <ul className="deckgo-shell-list deck-ui-sessions-list">
                  {props.lineage.nodes.map((node) => (
                    <li key={node.runId}>
                      <strong>{node.agentName ?? node.agentId}</strong>
                      <div className="deckgo-meta deck-ui-sessions-meta">
                        {t("lineageRunMeta", {
                          depth: node.depth,
                          runId: node.runId,
                          sessionKey: node.sessionKey,
                          status: node.status,
                        })}
                      </div>
                      {node.task ? (
                        <div className="deckgo-meta deck-ui-sessions-meta">{node.task}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="deckgo-note deck-ui-sessions-empty">{t("noChildLineage")}</p>
              )}
            </>
          ) : (
            <p className="deckgo-note deck-ui-sessions-empty">{t("noSubagentLineage")}</p>
          )}
          {props.relationships?.subagentRole ||
          props.relationships?.subagentControlScope ||
          props.relationships?.spawnedWorkspaceDir ? (
            <div className="deckgo-pill-row deck-ui-sessions-status-row deck-ui-sessions-actions-offset">
              {props.relationships.subagentRole ? (
                <span className="deckgo-pill">
                  {t("roleValue", { role: props.relationships.subagentRole })}
                </span>
              ) : null}
              {props.relationships.subagentControlScope ? (
                <span className="deckgo-pill">
                  {t("controlValue", { control: props.relationships.subagentControlScope })}
                </span>
              ) : null}
              {props.relationships.spawnedWorkspaceDir ? (
                <span className="deckgo-pill">
                  {t("workspaceValue", { workspace: props.relationships.spawnedWorkspaceDir })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {props.parentSessionKey || props.childSessionKeys.length > 0 ? (
        <div className="deckgo-surface-tile deck-ui-sessions-surface deck-ui-sessions-relations">
          <p className="deckgo-surface-label">{t("sessionRelations")}</p>
          {props.parentSessionKey ? (
            <button
              className="deckgo-button deck-ui-sessions-button"
              type="button"
              onClick={() => props.onSelectSessionKey(props.parentSessionKey)}
            >
              {t("parentButton", { sessionKey: props.parentSessionKey })}
            </button>
          ) : null}
          {props.childSessionKeys.length > 0 ? (
            <ul className="deckgo-shell-list deck-ui-sessions-list deck-ui-sessions-list-offset">
              {props.childSessionKeys.map((childKey) => (
                <li key={childKey}>
                  <button
                    className="deckgo-button deck-ui-sessions-button"
                    type="button"
                    onClick={() => props.onSelectSessionKey(childKey)}
                  >
                    {t("childButton", { sessionKey: childKey })}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
