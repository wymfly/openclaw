import { useTranslations } from "next-intl";
import type { DeckGoSubagentLineageNode } from "@/api-types";
import { useSessionLineageQuery } from "@/data/modules/sessions";
import { useChatStore } from "@/stores/chat";
import "./chat-widgets.css";
import { SubagentCard } from "./SubagentCard";

type LineageTreeNode = {
  node: DeckGoSubagentLineageNode;
  children: LineageTreeNode[];
};

function nodeLabel(node: DeckGoSubagentLineageNode) {
  return node.agentName || node.agentId || node.sessionKey;
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
  const hasChildren = entry.children.length > 0;

  return (
    <li className="ds-subagent-tree__node">
      <SubagentCard hasChildren={hasChildren} node={entry.node}>
        {hasChildren ? (
          <ul className="ds-subagent-tree__children">
            {entry.children.map((child) => (
              <SubagentTreeNode entry={child} key={child.node.runId || child.node.sessionKey} />
            ))}
          </ul>
        ) : null}
      </SubagentCard>
    </li>
  );
}

export function SubagentTree() {
  const t = useTranslations("chat");
  const activeSessionKey = useChatStore((state) => state.activeSessionKey);
  const lineageQuery = useSessionLineageQuery(activeSessionKey);
  const nodes = Array.isArray(lineageQuery.data?.nodes) ? lineageQuery.data.nodes : [];
  const loading = lineageQuery.isFetching;

  if (nodes.length === 0 && !loading) {
    return null;
  }

  const tree = buildLineageTree(nodes);

  return (
    <section className="ds-subagent-tree" aria-label={t("subagents")}>
      <header className="ds-subagent-tree__head">
        <strong>{t("subagents")}</strong>
        {loading ? <span className="ds-subagent-tree__loading">{t("subagentLoading")}</span> : null}
      </header>
      <ul className="ds-subagent-tree__list">
        {tree.map((entry) => (
          <SubagentTreeNode entry={entry} key={entry.node.runId || entry.node.sessionKey} />
        ))}
      </ul>
    </section>
  );
}
