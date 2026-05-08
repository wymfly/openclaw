import type { DeckGoSubagentsLineageResponse } from "@/api-types";
import { Badge, Button } from "../../../design-system/atoms";
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
        <section className="sessions-surface sessions-subagent-panel">
          <div className="sessions-section-heading">
            <h3>{t("subagentLineage")}</h3>
            <Badge variant={props.lineageState === "ready" ? "ok" : "neutral"}>
              {t("lineageStatus", { state: t(props.lineageState) })}
            </Badge>
          </div>
          <div className="sessions-actions">
            <Button size="sm" onClick={props.onOpenSubagents}>
              {t("openSubagentsPanel")}
            </Button>
          </div>
          {props.lineage ? (
            <>
              <div className="sessions-meta">
                {t("lineageRoot", {
                  agent: props.lineage.root.agentName ?? props.lineage.root.agentId,
                  sessionKey: props.lineage.root.sessionKey,
                })}
              </div>
              {props.lineage.nodes.length > 0 ? (
                <ul className="sessions-list">
                  {props.lineage.nodes.map((node) => (
                    <li className="sessions-timeline-row" key={node.runId}>
                      <div className="sessions-row-top">
                        <strong>{node.agentName ?? node.agentId}</strong>
                        <Badge variant={node.status === "running" ? "running" : "neutral"}>
                          {node.status}
                        </Badge>
                      </div>
                      <div className="sessions-meta">
                        {t("lineageRunMeta", {
                          depth: node.depth,
                          runId: node.runId,
                          sessionKey: node.sessionKey,
                          status: node.status,
                        })}
                      </div>
                      {node.task ? <div className="sessions-note">{node.task}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sessions-empty">{t("noChildLineage")}</p>
              )}
            </>
          ) : (
            <p className="sessions-empty">{t("noSubagentLineage")}</p>
          )}
          {props.relationships?.subagentRole ||
          props.relationships?.subagentControlScope ||
          props.relationships?.spawnedWorkspaceDir ? (
            <div className="sessions-status-row">
              {props.relationships.subagentRole ? (
                <Badge>{t("roleValue", { role: props.relationships.subagentRole })}</Badge>
              ) : null}
              {props.relationships.subagentControlScope ? (
                <Badge>
                  {t("controlValue", { control: props.relationships.subagentControlScope })}
                </Badge>
              ) : null}
              {props.relationships.spawnedWorkspaceDir ? (
                <Badge>
                  {t("workspaceValue", { workspace: props.relationships.spawnedWorkspaceDir })}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {props.parentSessionKey || props.childSessionKeys.length > 0 ? (
        <section className="sessions-surface sessions-relations-panel">
          <h3>{t("sessionRelations")}</h3>
          {props.parentSessionKey ? (
            <Button size="sm" onClick={() => props.onSelectSessionKey(props.parentSessionKey)}>
              {t("parentButton", { sessionKey: props.parentSessionKey })}
            </Button>
          ) : null}
          {props.childSessionKeys.length > 0 ? (
            <ul className="sessions-list">
              {props.childSessionKeys.map((childKey) => (
                <li className="sessions-timeline-row" key={childKey}>
                  <Button size="sm" onClick={() => props.onSelectSessionKey(childKey)}>
                    {t("childButton", { sessionKey: childKey })}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
