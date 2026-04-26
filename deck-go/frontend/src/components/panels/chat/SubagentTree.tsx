import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fetchSubagentLineage, type DeckGoSubagentLineageNode } from "@/api";
import { useChatStore } from "@/stores/chat";

type LineageTreeNode = {
  node: DeckGoSubagentLineageNode;
  children: LineageTreeNode[];
};

function nodeLabel(node: DeckGoSubagentLineageNode) {
  return node.agentName || node.agentId || node.sessionKey;
}

function nodeElapsed(node: DeckGoSubagentLineageNode) {
  if (typeof node.durationMs !== "number" || node.durationMs <= 0) {
    return "";
  }
  return `${(node.durationMs / 1000).toFixed(1)}s`;
}

function buildLineageTree(nodes: DeckGoSubagentLineageNode[]) {
  const knownRunIds = new Set(nodes.map((node) => node.runId).filter(Boolean));
  const childrenByParent = new Map<string, DeckGoSubagentLineageNode[]>();
  for (const node of nodes) {
    if (!node.parentRunId) {
      continue;
    }
    const siblings = childrenByParent.get(node.parentRunId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentRunId, siblings);
  }

  function build(node: DeckGoSubagentLineageNode, ancestors: Set<string>): LineageTreeNode {
    const children = (childrenByParent.get(node.runId) ?? [])
      .filter((child) => !ancestors.has(child.runId))
      .slice()
      .toSorted((left, right) =>
        left.depth === right.depth
          ? nodeLabel(left).localeCompare(nodeLabel(right))
          : left.depth - right.depth,
      )
      .map((child) => {
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(child.runId);
        return build(child, nextAncestors);
      });
    return { node, children };
  }

  return nodes
    .filter((node) => !node.parentRunId || !knownRunIds.has(node.parentRunId))
    .slice()
    .toSorted((left, right) =>
      left.depth === right.depth
        ? nodeLabel(left).localeCompare(nodeLabel(right))
        : left.depth - right.depth,
    )
    .map((node) => build(node, new Set([node.runId])));
}

function SubagentTreeNode({ entry }: { entry: LineageTreeNode }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = entry.children.length > 0;
  const elapsed = nodeElapsed(entry.node);

  return (
    <li className="deck-ui-subagent-node">
      <button
        aria-expanded={hasChildren ? expanded : undefined}
        className="deck-ui-subagent-row"
        data-run-id={entry.node.runId}
        type="button"
        onClick={() => {
          if (hasChildren) {
            setExpanded((current) => !current);
          }
        }}
      >
        <span className={`deck-ui-subagent-status is-${entry.node.status}`} aria-hidden="true" />
        <span className="deck-ui-subagent-label">{nodeLabel(entry.node)}</span>
        {entry.node.task ? (
          <small className="deck-ui-subagent-task">{entry.node.task}</small>
        ) : null}
        {elapsed ? <em className="deck-ui-subagent-elapsed">{elapsed}</em> : null}
      </button>
      {expanded && hasChildren ? (
        <ul className="deck-ui-subagent-children">
          {entry.children.map((child) => (
            <SubagentTreeNode entry={child} key={child.node.runId || child.node.sessionKey} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SubagentTree() {
  const t = useTranslations("chat");
  const activeSessionKey = useChatStore((state) => state.activeSessionKey);
  const [nodes, setNodes] = useState<DeckGoSubagentLineageNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeSessionKey) {
      setNodes([]);
      return undefined;
    }

    let cancelled = false;
    const loadLineage = async () => {
      setLoading(true);
      try {
        const lineage = await fetchSubagentLineage({ sessionKey: activeSessionKey });
        if (!cancelled) {
          setNodes(Array.isArray(lineage.nodes) ? lineage.nodes : []);
        }
      } catch {
        if (!cancelled) {
          setNodes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadLineage();
    return () => {
      cancelled = true;
    };
  }, [activeSessionKey]);

  if (nodes.length === 0 && !loading) {
    return null;
  }

  const tree = buildLineageTree(nodes);

  return (
    <section className="deck-ui-subagent-tree" aria-label={t("subagents")}>
      <header>
        <strong>{t("subagents")}</strong>
        {loading ? <span className="deck-ui-subagent-loading">Loading</span> : null}
      </header>
      <ul>
        {tree.map((entry) => (
          <SubagentTreeNode entry={entry} key={entry.node.runId || entry.node.sessionKey} />
        ))}
      </ul>
    </section>
  );
}
