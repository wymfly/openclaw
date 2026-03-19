"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { LineageNode } from "@/stores/deck-subagents";

interface LineageTreeProps {
  nodes: LineageNode[];
  rootSessionKey: string;
}

interface TreeNodeData {
  node: LineageNode;
  children: TreeNodeData[];
}

const statusIcons: Record<string, string> = {
  active: "\u{1F504}",
  completed: "\u{2705}",
  failed: "\u{274C}",
  timeout: "\u{23F1}\u{FE0F}",
};

function TreeNodeView({
  data,
  isLast,
  isOrphan,
}: {
  data: TreeNodeData;
  isLast: boolean;
  isOrphan?: boolean;
}) {
  const icon = statusIcons[data.node.status] ?? statusIcons.active;

  return (
    <li
      className={cn(
        "relative",
        !isLast && "border-l border-[var(--border)]",
        isOrphan && "border-l border-dashed border-[var(--warning)]",
      )}
    >
      {/* Horizontal connector */}
      <div className="flex items-center gap-2 pl-4 py-1 relative">
        <span className="absolute left-0 top-1/2 w-4 border-t border-[var(--border)]" aria-hidden />
        <span className="text-sm leading-none shrink-0" aria-label={data.node.status}>
          {icon}
        </span>
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
          {data.node.agentName ?? data.node.agentId}
        </span>
        {isOrphan && (
          <span className="text-[10px] text-[var(--warning)] italic shrink-0">(orphan)</span>
        )}
        <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60 shrink-0">
          d{data.node.depth}
        </span>
      </div>

      {/* Children */}
      {data.children.length > 0 && (
        <ul className="ml-6">
          {data.children.map((child, i) => (
            <TreeNodeView
              key={child.node.runId}
              data={child}
              isLast={i === data.children.length - 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface BuildResult {
  roots: TreeNodeData[];
  orphanRunIds: Set<string>;
}

/** Build tree from flat nodes using parentRunId. Orphan nodes are appended as top-level. */
function buildTree(nodes: LineageNode[]): BuildResult {
  const childrenMap = new Map<string | null, LineageNode[]>();
  const nodeIds = new Set(nodes.map((n) => n.runId));

  for (const node of nodes) {
    const key = node.parentRunId;
    const siblings = childrenMap.get(key) ?? [];
    siblings.push(node);
    childrenMap.set(key, siblings);
  }

  const visited = new Set<string>();
  const orphanRunIds = new Set<string>();

  function buildSubtree(parentRunId: string | null): TreeNodeData[] {
    const children = childrenMap.get(parentRunId) ?? [];
    return children.map((node) => {
      visited.add(node.runId);
      return { node, children: buildSubtree(node.runId) };
    });
  }

  const roots = buildSubtree(null);

  // Collect orphans: parentRunId points to a non-existent node
  for (const node of nodes) {
    if (!visited.has(node.runId) && node.parentRunId !== null && !nodeIds.has(node.parentRunId)) {
      orphanRunIds.add(node.runId);
      visited.add(node.runId);
      roots.push({ node, children: buildSubtree(node.runId) });
    }
  }

  return { roots, orphanRunIds };
}

/**
 * Pure CSS flexbox tree rendering a subagent call lineage with
 * ::before/::after connectors and status icons.
 * Accepts a flat `nodes` array from the API and builds tree structure locally.
 */
export function LineageTree({ nodes, rootSessionKey }: LineageTreeProps) {
  const { roots, orphanRunIds } = useMemo(() => buildTree(nodes), [nodes]);

  if (nodes.length === 0) {
    return (
      <p className="text-xs text-[var(--text-secondary)] italic">
        No lineage data for {rootSessionKey}
      </p>
    );
  }

  return (
    <ul className="space-y-0">
      {roots.map((data, i) => (
        <TreeNodeView
          key={data.node.runId}
          data={data}
          isLast={i === roots.length - 1}
          isOrphan={orphanRunIds.has(data.node.runId)}
        />
      ))}
    </ul>
  );
}
