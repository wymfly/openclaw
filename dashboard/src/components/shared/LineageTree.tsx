"use client";

import { cn } from "@/lib/utils";
import type { LineageNode } from "@/stores/deck-subagents";

interface LineageTreeProps {
  nodes: LineageNode[];
  rootSessionKey: string;
}

const statusIcons: Record<string, string> = {
  running: "\u{1F504}",
  completed: "\u{2705}",
  failed: "\u{274C}",
  timeout: "\u{23F1}\u{FE0F}",
};

function TreeNode({ node, isLast }: { node: LineageNode; isLast: boolean }) {
  const icon = statusIcons[node.status] ?? statusIcons.running;

  return (
    <li className={cn("relative", !isLast && "border-l border-[var(--border)]")}>
      {/* Horizontal connector */}
      <div className="flex items-center gap-2 pl-4 py-1 relative">
        <span className="absolute left-0 top-1/2 w-4 border-t border-[var(--border)]" aria-hidden />
        <span className="text-sm leading-none shrink-0" aria-label={node.status}>
          {icon}
        </span>
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
          {node.agentName ?? node.agentId}
        </span>
        <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60 shrink-0">
          d{node.depth}
        </span>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <ul className="ml-6">
          {node.children.map((child, i) => (
            <TreeNode key={child.sessionKey} node={child} isLast={i === node.children.length - 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Pure CSS flexbox tree rendering a subagent call lineage with
 * ::before/::after connectors and status icons.
 */
export function LineageTree({ nodes, rootSessionKey }: LineageTreeProps) {
  if (nodes.length === 0) {
    return (
      <p className="text-xs text-[var(--text-secondary)] italic">
        No lineage data for {rootSessionKey}
      </p>
    );
  }

  return (
    <ul className="space-y-0">
      {nodes.map((node, i) => (
        <TreeNode key={node.sessionKey} node={node} isLast={i === nodes.length - 1} />
      ))}
    </ul>
  );
}
