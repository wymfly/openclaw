import type { DeckGoSubagentsLineageResponse } from "../../../api";

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
  return (
    <>
      {props.isSubagent ? (
        <div className="deckgo-surface-tile deck-ui-sessions-surface deck-ui-sessions-subagent">
          <p className="deckgo-surface-label">Subagent lineage</p>
          <div className="deckgo-actions deck-ui-sessions-actions deck-ui-sessions-actions-offset">
            <button
              className="deckgo-button deck-ui-sessions-button"
              type="button"
              onClick={props.onOpenSubagents}
            >
              Open subagents panel
            </button>
          </div>
          {props.lineage ? (
            <>
              <div className="deckgo-meta">
                root: {props.lineage.root.sessionKey} | agent:{" "}
                {props.lineage.root.agentName ?? props.lineage.root.agentId}
              </div>
              {props.lineage.nodes.length > 0 ? (
                <ul className="deckgo-shell-list deck-ui-sessions-list">
                  {props.lineage.nodes.map((node) => (
                    <li key={node.runId}>
                      <strong>{node.agentName ?? node.agentId}</strong>
                      <div className="deckgo-meta deck-ui-sessions-meta">
                        run: {node.runId} | session: {node.sessionKey} | depth: {node.depth} |
                        status: {node.status}
                      </div>
                      {node.task ? (
                        <div className="deckgo-meta deck-ui-sessions-meta">{node.task}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="deckgo-note deck-ui-sessions-empty">
                  No child lineage nodes returned.
                </p>
              )}
            </>
          ) : (
            <p className="deckgo-note deck-ui-sessions-empty">No subagent lineage loaded.</p>
          )}
          {props.relationships?.subagentRole ||
          props.relationships?.subagentControlScope ||
          props.relationships?.spawnedWorkspaceDir ? (
            <div className="deckgo-pill-row deck-ui-sessions-status-row deck-ui-sessions-actions-offset">
              {props.relationships.subagentRole ? (
                <span className="deckgo-pill">role {props.relationships.subagentRole}</span>
              ) : null}
              {props.relationships.subagentControlScope ? (
                <span className="deckgo-pill">
                  control {props.relationships.subagentControlScope}
                </span>
              ) : null}
              {props.relationships.spawnedWorkspaceDir ? (
                <span className="deckgo-pill">
                  workspace {props.relationships.spawnedWorkspaceDir}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {props.parentSessionKey || props.childSessionKeys.length > 0 ? (
        <div className="deckgo-surface-tile deck-ui-sessions-surface deck-ui-sessions-relations">
          <p className="deckgo-surface-label">Session relations</p>
          {props.parentSessionKey ? (
            <button
              className="deckgo-button deck-ui-sessions-button"
              type="button"
              onClick={() => props.onSelectSessionKey(props.parentSessionKey)}
            >
              Parent {props.parentSessionKey}
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
                    Child {childKey}
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
