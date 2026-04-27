import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import type { DeckGoSubagentLineageNode } from "@/api";

function nodeLabel(node: DeckGoSubagentLineageNode) {
  return node.agentName || node.agentId || node.sessionKey;
}

function statusKey(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "running") {
    return "subagentRunning";
  }
  if (normalized === "completed" || normalized === "done" || normalized === "success") {
    return "subagentCompleted";
  }
  if (normalized === "failed" || normalized === "timeout" || normalized === "killed") {
    return "subagentFailed";
  }
  return `status_${normalized}`;
}

export function SubagentCard({
  children,
  defaultExpanded = true,
  hasChildren,
  node,
}: {
  children?: ReactNode;
  defaultExpanded?: boolean;
  hasChildren?: boolean;
  node: DeckGoSubagentLineageNode;
}) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const elapsed =
    typeof node.durationMs === "number" && node.durationMs > 0
      ? `${(node.durationMs / 1000).toFixed(1)}s`
      : "";
  const normalizedStatus = node.status.toLowerCase();

  return (
    <article className={`deck-ui-subagent-card is-${normalizedStatus}`}>
      <button
        aria-expanded={hasChildren ? expanded : undefined}
        className="deck-ui-subagent-row"
        data-run-id={node.runId}
        type="button"
        onClick={() => {
          if (hasChildren) {
            setExpanded((current) => !current);
          }
        }}
      >
        <span
          className={`deck-ui-subagent-status is-${normalizedStatus}`}
          data-subagent-status={normalizedStatus}
        />
        <span className="deck-ui-subagent-label">{nodeLabel(node)}</span>
        {node.task ? <small className="deck-ui-subagent-task">{node.task}</small> : null}
        <span className="deck-ui-subagent-badge">{t(statusKey(node.status))}</span>
        {elapsed ? <em className="deck-ui-subagent-elapsed">{elapsed}</em> : null}
      </button>
      {expanded && children ? <div className="deck-ui-subagent-card-body">{children}</div> : null}
    </article>
  );
}
