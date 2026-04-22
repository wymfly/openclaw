import { useEffect, useState } from "react";
import type { DeckGoNodeSummary, DeckGoPairingRequest } from "../../api";
import {
  approveNodePairing,
  describeNode,
  fetchNodePairing,
  fetchNodes,
  rejectNodePairing,
  renameNode,
} from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

export function RestoredNodesPanel() {
  const [nodes, setNodes] = useState<DeckGoNodeSummary[]>([]);
  const [pending, setPending] = useState<DeckGoPairingRequest[]>([]);
  const [nodeDetails, setNodeDetails] = useState<Record<string, DeckGoNodeSummary>>({});
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    "idle" | "describing" | "renaming" | "approving" | "rejecting"
  >("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredNodeId?: string) => {
    setLoadState("loading");
    try {
      const [nodesResponse, pairingResponse] = await Promise.all([
        fetchNodes(),
        fetchNodePairing(),
      ]);
      const nextNodes = nodesResponse.nodes ?? [];
      setNodes(nextNodes);
      setPending(pairingResponse.pending ?? []);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredNodeId?.trim() || nextNodes[0]?.nodeId || "";
      const nextSelected = nextNodes.some((node) => node.nodeId === selectedNodeId)
        ? selectedNodeId
        : nextNodes.some((node) => node.nodeId === fallbackId)
          ? fallbackId
          : nextNodes[0]?.nodeId || "";
      setSelectedNodeId(nextSelected);
      if (nextSelected) {
        const detail = await describeNode(nextSelected);
        setNodeDetails((current) => ({ ...current, [nextSelected]: detail }));
        setRenameValue(detail.displayName || detail.nodeId);
      } else {
        setRenameValue("");
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load nodes");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedNodeId || nodeDetails[selectedNodeId]) {
      return;
    }
    setActionState("describing");
    void describeNode(selectedNodeId)
      .then((detail) => {
        setNodeDetails((current) => ({ ...current, [selectedNodeId]: detail }));
        setRenameValue(detail.displayName || detail.nodeId);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "failed to describe node");
      })
      .finally(() => setActionState("idle"));
  }, [nodeDetails, selectedNodeId]);

  const selectedNode =
    (selectedNodeId ? nodeDetails[selectedNodeId] : null) ??
    nodes.find((node) => node.nodeId === selectedNodeId) ??
    nodes[0] ??
    null;
  const selectedRequest = selectedNodeId
    ? (pending.find((request) => request.nodeId === selectedNodeId) ?? null)
    : null;

  const renameAction = async () => {
    if (!selectedNode || !renameValue.trim()) {
      return;
    }
    setActionState("renaming");
    try {
      const result = await renameNode(selectedNode.nodeId, renameValue.trim());
      setActionResult(result);
      setError("");
      await refresh(selectedNode.nodeId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "node rename failed");
    } finally {
      setActionState("idle");
    }
  };

  const pairingAction = async (decision: "approve" | "reject") => {
    if (!selectedRequest) {
      return;
    }
    setActionState(decision === "approve" ? "approving" : "rejecting");
    try {
      const result =
        decision === "approve"
          ? await approveNodePairing(selectedRequest.requestId)
          : await rejectNodePairing(selectedRequest.requestId);
      setActionResult(result);
      setError("");
      await refresh(selectedNodeId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "node pairing action failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Nodes</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Inspect-first Vite node surface: list, describe, rename, and pairing decisions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Nodes {loadState}
              </span>
              <span className="deckgo-pill">{nodes.length} nodes</span>
              <span className="deckgo-pill">{pending.length} pending</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2">
              <ShellStat label="nodes" value={nodes.length} />
              <ShellStat label="pending requests" value={pending.length} />
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refresh(selectedNodeId)}
              >
                Refresh nodes
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {pending.length > 0 ? (
              <div className="deckgo-surface-tile">
                <p className="deckgo-surface-label">Pending pairing</p>
                <ul className="deckgo-shell-list">
                  {pending.map((request) => (
                    <li key={request.requestId}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card ${selectedRequest?.requestId === request.requestId ? "is-selected" : ""}`}
                        onClick={() => setSelectedNodeId(request.nodeId)}
                      >
                        <strong>{request.displayName || request.nodeId}</strong>
                        <div className="deckgo-meta">
                          request: {request.requestId} | repair: {request.isRepair ? "yes" : "no"}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {nodes.length === 0 ? (
              <p className="deckgo-note">No nodes loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {nodes.map((node) => (
                  <li key={node.nodeId}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedNode?.nodeId === node.nodeId ? "is-selected" : ""}`}
                      onClick={() => setSelectedNodeId(node.nodeId)}
                    >
                      <strong>{node.displayName || node.nodeId}</strong>
                      <div className="deckgo-meta">
                        platform: {node.platform || "n/a"} | connected:{" "}
                        {node.connected ? "yes" : "no"}
                      </div>
                      <div className="deckgo-meta">paired: {node.paired ? "yes" : "no"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected node</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice stays inspect-first and operational, not yet a full lifecycle dashboard.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedNode ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Node</p>
                    <strong>{selectedNode.displayName || selectedNode.nodeId}</strong>
                    <p className="deckgo-note">{selectedNode.platform || "unknown platform"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {selectedNode.connected ? "connected" : "offline"}
                    </span>
                    <span className="deckgo-pill">
                      {selectedNode.paired ? "paired" : "unpaired"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="version" value={selectedNode.version || "n/a"} />
                  <ShellStat label="remote ip" value={selectedNode.remoteIp || "n/a"} />
                </div>
                <div className="deckgo-actions">
                  <input
                    className="deckgo-input"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    placeholder="rename node"
                  />
                  <button
                    className="deckgo-button"
                    type="button"
                    onClick={() => void renameAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "renaming" ? "Renaming" : "Rename"}
                  </button>
                  {selectedRequest ? (
                    <>
                      <button
                        className="deckgo-button is-primary"
                        type="button"
                        onClick={() => void pairingAction("approve")}
                        disabled={actionState !== "idle"}
                      >
                        {actionState === "approving" ? "Approving" : "Approve pairing"}
                      </button>
                      <button
                        className="deckgo-button is-danger"
                        type="button"
                        onClick={() => void pairingAction("reject")}
                        disabled={actionState !== "idle"}
                      >
                        {actionState === "rejecting" ? "Rejecting" : "Reject pairing"}
                      </button>
                    </>
                  ) : null}
                </div>
                <JsonDetails title="Node payload" payload={selectedNode} />
                {selectedRequest ? (
                  <JsonDetails title="Pairing request" payload={selectedRequest} />
                ) : null}
              </>
            ) : (
              <p className="deckgo-note">Choose a node to inspect it.</p>
            )}
            {actionResult ? <JsonDetails title="Last node action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
