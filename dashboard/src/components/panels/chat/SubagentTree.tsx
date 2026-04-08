"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { deckFetch } from "@/lib/deck-client";
import { useChatStore } from "@/stores/chat";

interface SubagentNode {
  sessionKey: string;
  agentId: string;
  label?: string;
  status: "running" | "done" | "failed" | "killed" | "idle" | string;
  startedAt?: number;
  endedAt?: number;
  children: SubagentNode[];
}

/**
 * Tree visualization of SubAgent execution within the active session.
 * Shows hierarchical progress with expand/collapse.
 */
export function SubagentTree() {
  const t = useTranslations("chat");
  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const [tree, setTree] = useState<SubagentNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeSessionKey) {
      setTree([]);
      return;
    }
    let cancelled = false;
    const fetchTree = async () => {
      setLoading(true);
      try {
        // TODO: Wire to actual API route — /api/deck/subagents/lineage does not exist yet.
        // Integration step: create route calling gwRequest("deck.subagents.lineage", { sessionKey })
        // or build tree from store's childSessions data instead of fetching.
        const res = await deckFetch(`/api/deck/subagents/lineage?sessionKey=${activeSessionKey}`);
        const data = (await res.json()) as { nodes?: SubagentNode[] };
        if (!cancelled && Array.isArray(data.nodes)) {
          setTree(data.nodes);
        }
      } catch {
        // Non-critical — tree is supplementary
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchTree();
    return () => {
      cancelled = true;
    };
  }, [activeSessionKey]);

  if (tree.length === 0 && !loading) return null;

  return (
    <div
      className="border-t px-3 py-2"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
          {t("subagents")}
        </span>
        {loading && (
          <Loader2
            size={12}
            className="animate-spin"
            style={{ color: "var(--muted-foreground)" }}
          />
        )}
      </div>
      <div className="space-y-0.5">
        {tree.map((node) => (
          <TreeNode key={node.sessionKey} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, depth }: { node: SubagentNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const elapsed =
    node.startedAt && node.endedAt
      ? `${((node.endedAt - node.startedAt) / 1000).toFixed(1)}s`
      : node.startedAt
        ? "..."
        : "";

  return (
    <div style={{ marginLeft: depth * 12 }}>
      <button
        type="button"
        className="flex items-center gap-1 w-full text-left text-[11px] py-0.5 rounded transition-colors"
        style={{ color: "var(--foreground)" }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={12} style={{ color: "var(--muted-foreground)" }} />
          ) : (
            <ChevronRight size={12} style={{ color: "var(--muted-foreground)" }} />
          )
        ) : (
          <span className="w-3" />
        )}
        <StatusDot status={node.status} />
        <span className="truncate">{node.label || node.agentId}</span>
        {elapsed && (
          <span className="ml-auto text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {elapsed}
          </span>
        )}
      </button>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode key={child.sessionKey} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorVar =
    status === "running"
      ? "--status-connected"
      : status === "done"
        ? "--success"
        : status === "failed" || status === "killed"
          ? "--destructive"
          : "--muted-foreground";
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ backgroundColor: `var(${colorVar})` }}
    />
  );
}
