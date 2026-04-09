"use client";

import { Server } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { PanelError } from "@/components/ui/panel-error";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { useNodesStore } from "@/stores/nodes";
import { NodeCard } from "./NodeCard";
import { PairingRequestCard } from "./PairingRequestCard";

export default function NodeManagementPanel() {
  const t = useTranslations("nodes");
  const {
    nodes,
    pairingRequests,
    selectedNodeId,
    loading,
    error,
    fetchNodes,
    fetchPairing,
    selectNode,
  } = useNodesStore();

  useEffect(() => {
    void fetchNodes();
    void fetchPairing();
  }, [fetchNodes, fetchPairing]);

  if (loading && nodes.length === 0) {
    return <PanelSkeleton variant="list" />;
  }
  if (error) {
    return <PanelError error={error} onRetry={fetchNodes} />;
  }
  if (nodes.length === 0 && pairingRequests.length === 0) {
    return (
      <PanelEmptyState
        icon={<Server size={40} strokeWidth={1.2} />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  const selectedNode = nodes.find((n) => n.nodeId === selectedNodeId);

  return (
    <div className="flex h-full">
      {/* Left: node list + pairing requests */}
      <div
        className="w-[260px] shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Pairing requests section */}
        {pairingRequests.length > 0 && (
          <div>
            <div
              className="sticky top-0 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: "var(--warning-muted)",
                color: "var(--warning-muted-text)",
              }}
            >
              {t("pendingRequests")} ({pairingRequests.length})
            </div>
            {pairingRequests.map((req) => (
              <PairingRequestCard key={req.requestId} request={req} />
            ))}
          </div>
        )}

        {/* Nodes section */}
        <div>
          <div
            className="sticky top-0 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            {t("nodesList")} ({nodes.length})
          </div>
          {nodes.map((node) => (
            <button
              key={node.nodeId}
              type="button"
              onClick={() => selectNode(node.nodeId)}
              className="w-full text-left px-3 py-2 transition-colors hover:bg-[var(--accent)]"
              style={{
                backgroundColor: node.nodeId === selectedNodeId ? "var(--accent)" : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: node.connected
                      ? "var(--status-connected)"
                      : "var(--status-disconnected)",
                  }}
                />
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: "var(--foreground)" }}
                >
                  {node.displayName ?? node.nodeId}
                </span>
              </div>
              {node.platform && (
                <span className="text-[10px] text-[var(--muted-foreground)] ml-4">
                  {node.platform}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedNode ? (
          <NodeCard node={selectedNode} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--muted-foreground)]">
            {t("selectNode")}
          </div>
        )}
      </div>
    </div>
  );
}
