"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TreeDAGNode {
  id: string;
  parentId: string | null;
  label: string;
  sublabel?: string;
  status: "active" | "completed" | "failed" | "timeout";
  startedAt?: number;
  durationMs?: number;
  attachments?: Array<{ name: string; type: string; size: number }>;
  sessionKey?: string;
}

export interface TreeDAGProps {
  nodes: TreeDAGNode[];
  maxNodes?: number;
  onNodeClick?: (node: TreeDAGNode) => void;
  highlightNodeId?: string | null;
  renderActions?: (node: TreeDAGNode) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Internal tree structure
// ---------------------------------------------------------------------------

interface InternalTreeNode {
  node: TreeDAGNode;
  children: InternalTreeNode[];
}

function buildTree(nodes: TreeDAGNode[]): InternalTreeNode[] {
  const childrenMap = new Map<string | null, TreeDAGNode[]>();
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    const key = node.parentId;
    const siblings = childrenMap.get(key) ?? [];
    siblings.push(node);
    childrenMap.set(key, siblings);
  }

  const visited = new Set<string>();

  function buildSubtree(parentId: string | null): InternalTreeNode[] {
    const children = childrenMap.get(parentId) ?? [];
    return children.map((node) => {
      visited.add(node.id);
      return { node, children: buildSubtree(node.id) };
    });
  }

  const roots = buildSubtree(null);

  // Orphans: parentId set but parent not in nodes list
  for (const node of nodes) {
    if (!visited.has(node.id) && node.parentId !== null && !nodeIds.has(node.parentId)) {
      visited.add(node.id);
      roots.push({ node, children: buildSubtree(node.id) });
    }
  }

  return roots;
}

/** Collect all descendant ids (inclusive). */
function collectDescendants(tree: InternalTreeNode): Set<string> {
  const ids = new Set<string>();
  function walk(t: InternalTreeNode) {
    ids.add(t.node.id);
    for (const c of t.children) {
      walk(c);
    }
  }
  walk(tree);
  return ids;
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

const statusColors: Record<TreeDAGNode["status"], string> = {
  active: "var(--accent)",
  completed: "var(--success)",
  failed: "var(--danger)",
  timeout: "var(--warning)",
};

const statusIcons: Record<TreeDAGNode["status"], string> = {
  active: "\u25B6", // play triangle
  completed: "\u2713", // checkmark
  failed: "\u2717", // x mark
  timeout: "\u23F1", // stopwatch
};

// ---------------------------------------------------------------------------
// Elapsed time helper
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainSec}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Live elapsed hook
// ---------------------------------------------------------------------------

function useLiveElapsed(status: TreeDAGNode["status"], startedAt?: number): string | null {
  const [elapsed, setElapsed] = useState<number>(0);
  const isActive = status === "active";

  useEffect(() => {
    if (!isActive || startedAt == null) {
      return;
    }
    const update = () => setElapsed(Date.now() - startedAt);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isActive, startedAt]);

  if (!isActive && startedAt == null) {
    return null;
  }
  if (isActive && startedAt != null) {
    return formatElapsed(elapsed);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Node card component
// ---------------------------------------------------------------------------

interface NodeCardProps {
  node: TreeDAGNode;
  isHighlighted: boolean;
  isSubtreeHighlighted: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  renderActions?: (node: TreeDAGNode) => React.ReactNode;
  nodeRef: (el: HTMLDivElement | null) => void;
}

function NodeCard({
  node,
  isHighlighted,
  isSubtreeHighlighted,
  onClick,
  onMouseEnter,
  onMouseLeave,
  renderActions,
  nodeRef,
}: NodeCardProps) {
  const liveElapsed = useLiveElapsed(node.status, node.startedAt);
  const statusColor = statusColors[node.status];
  const icon = statusIcons[node.status];

  const displayTime =
    node.status === "active"
      ? liveElapsed
      : node.durationMs != null
        ? formatElapsed(node.durationMs)
        : null;

  return (
    <div
      ref={nodeRef}
      data-node-id={node.id}
      className={cn(
        "relative rounded-lg border px-3 py-2 min-w-[140px] max-w-[220px] transition-all duration-150 cursor-default select-none",
        "bg-[var(--bg-secondary)] border-[var(--border)]",
        isHighlighted && "ring-2 ring-[var(--accent)] shadow-[var(--accent-glow)]",
        isSubtreeHighlighted && !isHighlighted && "border-[var(--accent)] opacity-90",
        onClick && "cursor-pointer hover:border-[var(--accent)]",
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Status icon + agent badge */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0"
          style={{ backgroundColor: statusColor, color: "var(--bg-primary)" }}
          aria-label={node.status}
        >
          {icon}
        </span>
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
          {node.label}
        </span>
      </div>

      {/* Task summary */}
      {node.sublabel && (
        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mb-1">
          {node.sublabel}
        </p>
      )}

      {/* Elapsed time */}
      {displayTime && (
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">{displayTime}</span>
      )}

      {/* Custom actions */}
      {renderActions && <div className="mt-1.5">{renderActions(node)}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree node layout (recursive, CSS flexbox)
// ---------------------------------------------------------------------------

interface TreeNodeLayoutProps {
  treeNode: InternalTreeNode;
  highlightNodeId?: string | null;
  hoveredSubtreeIds: Set<string>;
  onNodeClick?: (node: TreeDAGNode) => void;
  onHoverNode: (treeNode: InternalTreeNode | null) => void;
  renderActions?: (node: TreeDAGNode) => React.ReactNode;
  nodeRefs: React.RefObject<Map<string, HTMLDivElement>>;
}

function TreeNodeLayout({
  treeNode,
  highlightNodeId,
  hoveredSubtreeIds,
  onNodeClick,
  onHoverNode,
  renderActions,
  nodeRefs,
}: TreeNodeLayoutProps) {
  const handleRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) {
        nodeRefs.current.set(treeNode.node.id, el);
      } else {
        nodeRefs.current.delete(treeNode.node.id);
      }
    },
    [treeNode.node.id, nodeRefs],
  );

  return (
    <div className="flex flex-col items-center gap-8">
      <NodeCard
        node={treeNode.node}
        isHighlighted={highlightNodeId === treeNode.node.id}
        isSubtreeHighlighted={hoveredSubtreeIds.has(treeNode.node.id)}
        onClick={onNodeClick ? () => onNodeClick(treeNode.node) : undefined}
        onMouseEnter={() => onHoverNode(treeNode)}
        onMouseLeave={() => onHoverNode(null)}
        renderActions={renderActions}
        nodeRef={handleRef}
      />

      {treeNode.children.length > 0 && (
        <div className="flex gap-6 justify-center">
          {treeNode.children.map((child) => (
            <TreeNodeLayout
              key={child.node.id}
              treeNode={child}
              highlightNodeId={highlightNodeId}
              hoveredSubtreeIds={hoveredSubtreeIds}
              onNodeClick={onNodeClick}
              onHoverNode={onHoverNode}
              renderActions={renderActions}
              nodeRefs={nodeRefs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edge type for SVG
// ---------------------------------------------------------------------------

interface Edge {
  parentId: string;
  childId: string;
  hasAttachments: boolean;
  attachments: TreeDAGNode["attachments"];
}

function collectEdges(nodes: TreeDAGNode[]): Edge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  for (const node of nodes) {
    if (node.parentId != null && nodeMap.has(node.parentId)) {
      edges.push({
        parentId: node.parentId,
        childId: node.id,
        hasAttachments: (node.attachments?.length ?? 0) > 0,
        attachments: node.attachments,
      });
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// SVG edges overlay
// ---------------------------------------------------------------------------

interface SVGEdgesProps {
  edges: Edge[];
  nodeRefs: React.RefObject<Map<string, HTMLDivElement>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface ComputedPath {
  d: string;
  midX: number;
  midY: number;
  edge: Edge;
}

function SVGEdges({ edges, nodeRefs, containerRef }: SVGEdgesProps) {
  const [paths, setPaths] = useState<ComputedPath[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const computePaths = () => {
      const containerRect = container.getBoundingClientRect();
      const computed: ComputedPath[] = [];

      for (const edge of edges) {
        const parentEl = nodeRefs.current.get(edge.parentId);
        const childEl = nodeRefs.current.get(edge.childId);
        if (!parentEl || !childEl) {
          continue;
        }

        const parentRect = parentEl.getBoundingClientRect();
        const childRect = childEl.getBoundingClientRect();

        // Parent bottom-center
        const x1 = parentRect.left + parentRect.width / 2 - containerRect.left;
        const y1 = parentRect.bottom - containerRect.top;
        // Child top-center
        const x2 = childRect.left + childRect.width / 2 - containerRect.left;
        const y2 = childRect.top - containerRect.top;

        // Cubic bezier with control points halfway vertically
        const cy = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;

        const midX = (x1 + x2) / 2;
        const midY = cy;

        computed.push({ d, midX, midY, edge });
      }

      setPaths(computed);
    };

    computePaths();

    // Recompute on resize
    const observer = new ResizeObserver(computePaths);
    observer.observe(container);

    return () => observer.disconnect();
  }, [edges, nodeRefs, containerRef]);

  if (paths.length === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      {paths.map((p) => (
        <g key={`${p.edge.parentId}-${p.edge.childId}`}>
          <path d={p.d} fill="none" stroke="var(--border)" strokeWidth={1.5} />
          {p.edge.hasAttachments && p.edge.attachments && (
            <AttachmentBadge x={p.midX} y={p.midY} attachments={p.edge.attachments} />
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Attachment badge (SVG foreignObject)
// ---------------------------------------------------------------------------

interface AttachmentBadgeProps {
  x: number;
  y: number;
  attachments: NonNullable<TreeDAGNode["attachments"]>;
}

function AttachmentBadge({ x, y, attachments }: AttachmentBadgeProps) {
  return (
    <foreignObject
      x={x - 10}
      y={y - 10}
      width={20}
      height={20}
      className="overflow-visible pointer-events-auto"
    >
      <Tooltip>
        <TooltipTrigger
          render={<span />}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] cursor-default"
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="flex flex-col gap-0.5">
            {attachments.map((a, i) => (
              <span key={i} className="text-[10px]">
                {a.name} ({a.type}, {formatFileSize(a.size)})
              </span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </foreignObject>
  );
}

// ---------------------------------------------------------------------------
// Main TreeDAG component
// ---------------------------------------------------------------------------

export function TreeDAG({
  nodes,
  maxNodes = 50,
  onNodeClick,
  highlightNodeId,
  renderActions,
}: TreeDAGProps) {
  const t = useTranslations("common");
  const [showAll, setShowAll] = useState(false);
  const [hoveredSubtreeIds, setHoveredSubtreeIds] = useState<Set<string>>(() => new Set());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Truncate if needed
  const truncated = !showAll && nodes.length > maxNodes;
  const visibleNodes = truncated ? nodes.slice(0, maxNodes) : nodes;

  const roots = useMemo(() => buildTree(visibleNodes), [visibleNodes]);
  const edges = useMemo(() => collectEdges(visibleNodes), [visibleNodes]);

  const handleHoverNode = useCallback((treeNode: InternalTreeNode | null) => {
    if (!treeNode) {
      setHoveredSubtreeIds(new Set());
      return;
    }
    setHoveredSubtreeIds(collectDescendants(treeNode));
  }, []);

  // showMore fallback: T9 will add common.showMore; until then use try/catch
  let showMoreLabel: string;
  try {
    showMoreLabel = t("showMore");
  } catch {
    showMoreLabel = "Show more";
  }

  if (visibleNodes.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      {/* SVG edge overlay */}
      <SVGEdges edges={edges} nodeRefs={nodeRefs} containerRef={containerRef} />

      {/* Tree layout */}
      <div className="flex flex-col items-center gap-8">
        {roots.map((root) => (
          <TreeNodeLayout
            key={root.node.id}
            treeNode={root}
            highlightNodeId={highlightNodeId}
            hoveredSubtreeIds={hoveredSubtreeIds}
            onNodeClick={onNodeClick}
            onHoverNode={handleHoverNode}
            renderActions={renderActions}
            nodeRefs={nodeRefs}
          />
        ))}
      </div>

      {/* Truncation link */}
      {truncated && (
        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
            onClick={() => setShowAll(true)}
          >
            {showMoreLabel} ({nodes.length - maxNodes})
          </button>
        </div>
      )}
    </div>
  );
}
