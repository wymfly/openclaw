import { useEffect, useState } from "react";
import type {
  DeckGoNodePendingWorkPriority,
  DeckGoNodePendingWorkType,
  DeckGoNodeSummary,
  DeckGoPairingRequest,
} from "../../../api";
import {
  approveNodePairing,
  describeNode,
  enqueueNodePendingWork,
  fetchNodePairing,
  fetchNodes,
  invokeNodeCommand,
  rejectNodePairing,
  renameNode,
  requestNodePairing,
  verifyNodePairing,
} from "../../../api";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";

type NodeLifecycleSummary = {
  tone: "success" | "warning" | "neutral";
  title: string;
  description: string;
  nextStep: string;
};

function getNodeLifecycleSummary(
  node: DeckGoNodeSummary,
  pendingRequest: DeckGoPairingRequest | null,
): NodeLifecycleSummary {
  if (pendingRequest?.isRepair) {
    return {
      tone: "warning",
      title: "Repair requested",
      description:
        "This node was previously paired and is requesting repair approval to recover access.",
      nextStep: "Review the repair request and approve it if the device is trusted.",
    };
  }
  if (pendingRequest) {
    return {
      tone: "warning",
      title: "Pending pairing request",
      description: "This node is waiting for approval before it can become a paired device.",
      nextStep: "Approve or reject the pending request to continue onboarding.",
    };
  }
  if (node.connected && node.paired) {
    return {
      tone: "success",
      title: "Connected and ready",
      description:
        "This node is paired and currently connected, so remote capabilities should be available.",
      nextStep: "Inspect capabilities and commands to understand what this node can do.",
    };
  }
  if (node.paired) {
    return {
      tone: "warning",
      title: "Paired but offline",
      description: "This node is paired, but it is not currently connected to the gateway.",
      nextStep: "Bring the node back online or run repair if connectivity cannot recover.",
    };
  }
  return {
    tone: "neutral",
    title: "Unpaired",
    description: "This node has not finished pairing, so remote access is not yet available.",
    nextStep: "Start or approve a pairing flow before expecting remote node features to work.",
  };
}

function formatNodeTimestamp(value?: number) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "n/a" : date.toLocaleString();
}

export function NodesPanel() {
  const [nodes, setNodes] = useState<DeckGoNodeSummary[]>([]);
  const [pending, setPending] = useState<DeckGoPairingRequest[]>([]);
  const [nodeDetails, setNodeDetails] = useState<Record<string, DeckGoNodeSummary>>({});
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [invokeCommand, setInvokeCommand] = useState("");
  const [invokeParamsJson, setInvokeParamsJson] = useState("{}");
  const [invokeTimeoutMs, setInvokeTimeoutMs] = useState("15000");
  const [pendingWorkType, setPendingWorkType] =
    useState<DeckGoNodePendingWorkType>("status.request");
  const [pendingPriority, setPendingPriority] = useState<DeckGoNodePendingWorkPriority>("normal");
  const [pendingWake, setPendingWake] = useState(true);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    | "idle"
    | "describing"
    | "renaming"
    | "approving"
    | "requesting"
    | "rejecting"
    | "verifying"
    | "invoking"
    | "enqueueing"
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
      const nextSelected =
        fallbackId && nextNodes.some((node) => node.nodeId === fallbackId)
          ? fallbackId
          : selectedNodeId && nextNodes.some((node) => node.nodeId === selectedNodeId)
            ? selectedNodeId
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
    if (
      !selectedNodeId ||
      nodeDetails[selectedNodeId] ||
      !nodes.some((node) => node.nodeId === selectedNodeId)
    ) {
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
  }, [nodeDetails, nodes, selectedNodeId]);

  const selectedNode = selectedNodeId
    ? (nodeDetails[selectedNodeId] ?? nodes.find((node) => node.nodeId === selectedNodeId) ?? null)
    : (nodes[0] ?? null);
  const selectedRequest = selectedNodeId
    ? (pending.find((request) => request.nodeId === selectedNodeId) ?? null)
    : null;
  const lifecycle = selectedNode ? getNodeLifecycleSummary(selectedNode, selectedRequest) : null;
  const selectedPermissions = selectedNode
    ? Object.entries(selectedNode.permissions ?? {}).toSorted(([left], [right]) =>
        left.localeCompare(right),
      )
    : [];
  const selectedInvokeCommand = selectedNode?.commands.includes(invokeCommand)
    ? invokeCommand
    : (selectedNode?.commands[0] ?? "");

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

  const parseInvokeParams = () => {
    const raw = invokeParamsJson.trim();
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as unknown;
  };

  const invokeAction = async () => {
    if (!selectedNode || !selectedInvokeCommand) {
      return;
    }
    if (
      !window.confirm(`Invoke node command ${selectedInvokeCommand} on ${selectedNode.nodeId}?`)
    ) {
      return;
    }
    let params: unknown;
    try {
      params = parseInvokeParams();
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? `Invalid invoke params JSON: ${parseError.message}`
          : "Invalid invoke params JSON",
      );
      return;
    }
    const timeoutMs = Number.parseInt(invokeTimeoutMs.trim(), 10);
    setActionState("invoking");
    try {
      const result = await invokeNodeCommand(
        selectedNode.nodeId,
        selectedInvokeCommand,
        params,
        Number.isFinite(timeoutMs) ? timeoutMs : undefined,
      );
      setActionResult(result);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "node invoke failed");
    } finally {
      setActionState("idle");
    }
  };

  const enqueuePendingWorkAction = async () => {
    if (!selectedNode) {
      return;
    }
    if (!window.confirm(`Queue ${pendingWorkType} pending work for ${selectedNode.nodeId}?`)) {
      return;
    }
    setActionState("enqueueing");
    try {
      const result = await enqueueNodePendingWork({
        nodeId: selectedNode.nodeId,
        priority: pendingPriority,
        type: pendingWorkType,
        wake: pendingWake,
      });
      setActionResult(result);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "node pending enqueue failed");
    } finally {
      setActionState("idle");
    }
  };

  const pairingAction = async (decision: "approve" | "reject") => {
    if (!selectedRequest) {
      return;
    }
    const actionLabel = decision === "approve" ? "Approve" : "Reject";
    if (!window.confirm(`${actionLabel} node pairing request ${selectedRequest.requestId}?`)) {
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

  const requestPairingAction = async () => {
    if (!selectedNode) {
      return;
    }
    if (!window.confirm(`Request node pairing for ${selectedNode.nodeId}?`)) {
      return;
    }
    setActionState("requesting");
    try {
      const result = await requestNodePairing({
        nodeId: selectedNode.nodeId,
        displayName: selectedNode.displayName,
        platform: selectedNode.platform,
        version: selectedNode.version,
        coreVersion: selectedNode.coreVersion,
        uiVersion: selectedNode.uiVersion,
        deviceFamily: selectedNode.deviceFamily,
        modelIdentifier: selectedNode.modelIdentifier,
        caps: selectedNode.caps,
        commands: selectedNode.commands,
        remoteIp: selectedNode.remoteIp,
      });
      setActionResult(result);
      setError("");
      await refresh(selectedNode.nodeId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "node pairing request failed");
    } finally {
      setActionState("idle");
    }
  };

  const verifyPairingAction = async () => {
    if (!selectedNode || !verifyToken.trim()) {
      return;
    }
    setActionState("verifying");
    try {
      const result = await verifyNodePairing(selectedNode.nodeId, verifyToken.trim());
      setActionResult(result);
      setVerifyToken("");
      setError("");
      await refresh(selectedNode.nodeId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "node pairing verify failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-nodes">
      <div className="deckgo-column deck-ui-nodes-column">
        <article className="deckgo-card is-float deck-ui-nodes-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Nodes</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Manage node inventory, pairing, command invocation, and pending work.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-nodes-body">
            <div className="deckgo-pill-row deck-ui-nodes-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Nodes {loadState}
              </span>
              <span className="deckgo-pill">{nodes.length} nodes</span>
              <span className="deckgo-pill">{pending.length} pending</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-nodes-stats">
              <ShellStat label="nodes" value={nodes.length} />
              <ShellStat label="pending requests" value={pending.length} />
            </div>
            <div className="deckgo-actions deck-ui-nodes-actions">
              <button
                className="deckgo-button deck-ui-nodes-button"
                type="button"
                onClick={() => void refresh(selectedNodeId)}
              >
                Refresh nodes
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-nodes-error">{error}</p> : null}
            {pending.length > 0 ? (
              <div className="deckgo-surface-tile deck-ui-nodes-surface">
                <p className="deckgo-surface-label">Pending pairing</p>
                <ul className="deckgo-shell-list deck-ui-nodes-list">
                  {pending.map((request) => (
                    <li key={request.requestId}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card deck-ui-nodes-row ${selectedRequest?.requestId === request.requestId ? "is-selected" : ""}`}
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
              <p className="deckgo-note deck-ui-nodes-empty">No nodes loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-nodes-list">
                {nodes.map((node) => (
                  <li key={node.nodeId}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-nodes-row ${selectedNode?.nodeId === node.nodeId ? "is-selected" : ""}`}
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

      <div className="deckgo-column deckgo-panel-main deck-ui-nodes-column">
        <article className="deckgo-card is-float deck-ui-nodes-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected node</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Inspect node state, pairing requests, lifecycle diagnostics, invoke, and pending work
            from current node routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-nodes-body">
            {selectedNode ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-nodes-hero">
                  <div>
                    <p className="deckgo-kicker">Node</p>
                    <strong>{selectedNode.displayName || selectedNode.nodeId}</strong>
                    <p className="deckgo-note">{selectedNode.platform || "unknown platform"}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-nodes-status-row">
                    <span className="deckgo-pill">
                      {selectedNode.connected ? "connected" : "offline"}
                    </span>
                    <span className="deckgo-pill">
                      {selectedNode.paired ? "paired" : "unpaired"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-nodes-detail-stats">
                  <ShellStat label="version" value={selectedNode.version || "n/a"} />
                  <ShellStat label="remote ip" value={selectedNode.remoteIp || "n/a"} />
                  <ShellStat label="core version" value={selectedNode.coreVersion || "n/a"} />
                  <ShellStat label="ui version" value={selectedNode.uiVersion || "n/a"} />
                  <ShellStat label="device family" value={selectedNode.deviceFamily || "n/a"} />
                  <ShellStat label="model" value={selectedNode.modelIdentifier || "n/a"} />
                  <ShellStat
                    label="connected at"
                    value={formatNodeTimestamp(selectedNode.connectedAtMs)}
                  />
                  <ShellStat label="path env" value={selectedNode.pathEnv || "n/a"} />
                </div>
                {lifecycle ? (
                  <div className="deckgo-surface-tile deck-ui-nodes-surface">
                    <div className="deckgo-pill-row deck-ui-nodes-status-row">
                      <span
                        className={`deckgo-pill ${
                          lifecycle.tone === "success"
                            ? "is-positive"
                            : lifecycle.tone === "warning"
                              ? "is-warning"
                              : "is-muted"
                        }`}
                      >
                        {lifecycle.title}
                      </span>
                    </div>
                    <p className="deckgo-note">{lifecycle.description}</p>
                    <p className="deckgo-meta">Next step: {lifecycle.nextStep}</p>
                  </div>
                ) : null}
                <div className="deckgo-actions deck-ui-nodes-actions">
                  <input
                    className="deckgo-input deck-ui-nodes-input"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    placeholder="rename node"
                    aria-label="Node display name"
                  />
                  <button
                    className="deckgo-button deck-ui-nodes-button"
                    type="button"
                    onClick={() => void renameAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "renaming" ? "Renaming" : "Rename"}
                  </button>
                  {selectedRequest ? (
                    <>
                      <button
                        className="deckgo-button is-primary deck-ui-nodes-button"
                        type="button"
                        onClick={() => void pairingAction("approve")}
                        disabled={actionState !== "idle"}
                      >
                        {actionState === "approving" ? "Approving" : "Approve pairing"}
                      </button>
                      <button
                        className="deckgo-button is-danger deck-ui-nodes-button"
                        type="button"
                        onClick={() => void pairingAction("reject")}
                        disabled={actionState !== "idle"}
                      >
                        {actionState === "rejecting" ? "Rejecting" : "Reject pairing"}
                      </button>
                    </>
                  ) : null}
                  {!selectedRequest && !selectedNode.paired ? (
                    <button
                      className="deckgo-button deck-ui-nodes-button"
                      type="button"
                      onClick={() => void requestPairingAction()}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "requesting" ? "Requesting" : "Request pairing"}
                    </button>
                  ) : null}
                </div>
                <div className="deckgo-actions deck-ui-nodes-actions">
                  <input
                    className="deckgo-input deck-ui-nodes-input"
                    value={verifyToken}
                    onChange={(event) => setVerifyToken(event.target.value)}
                    placeholder="pairing verification token"
                    aria-label="Pairing verification token"
                  />
                  <button
                    className="deckgo-button deck-ui-nodes-button"
                    type="button"
                    onClick={() => void verifyPairingAction()}
                    disabled={actionState !== "idle" || !verifyToken.trim()}
                  >
                    {actionState === "verifying" ? "Verifying" : "Verify pairing"}
                  </button>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">Invoke node command</p>
                  <p className="deckgo-note">
                    Uses Gateway `node.invoke`; command allowlists and approvals remain enforced by
                    Gateway.
                  </p>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <select
                      aria-label="Node command"
                      className="deckgo-input deck-ui-nodes-input"
                      disabled={selectedNode.commands.length === 0}
                      onChange={(event) => setInvokeCommand(event.target.value)}
                      value={selectedInvokeCommand}
                    >
                      {selectedNode.commands.length === 0 ? (
                        <option value="">No commands advertised</option>
                      ) : (
                        selectedNode.commands.map((command) => (
                          <option key={command} value={command}>
                            {command}
                          </option>
                        ))
                      )}
                    </select>
                    <input
                      aria-label="Node invoke timeout"
                      className="deckgo-input deck-ui-nodes-input"
                      onChange={(event) => setInvokeTimeoutMs(event.target.value)}
                      placeholder="timeout ms"
                      value={invokeTimeoutMs}
                    />
                  </div>
                  <textarea
                    aria-label="Node invoke params JSON"
                    className="deckgo-textarea deck-ui-nodes-textarea"
                    onChange={(event) => setInvokeParamsJson(event.target.value)}
                    rows={4}
                    value={invokeParamsJson}
                  />
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <button
                      className="deckgo-button is-primary deck-ui-nodes-button"
                      disabled={
                        actionState !== "idle" ||
                        !selectedInvokeCommand ||
                        selectedNode.commands.length === 0
                      }
                      onClick={() => void invokeAction()}
                      type="button"
                    >
                      {actionState === "invoking" ? "Invoking" : "Invoke command"}
                    </button>
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">Pending work</p>
                  <p className="deckgo-note">
                    Queues Gateway `node.pending.enqueue` work for nodes that need a wake/pull cycle
                    before they can report status or location.
                  </p>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <select
                      aria-label="Pending work type"
                      className="deckgo-input deck-ui-nodes-input"
                      onChange={(event) =>
                        setPendingWorkType(event.target.value as DeckGoNodePendingWorkType)
                      }
                      value={pendingWorkType}
                    >
                      <option value="status.request">status.request</option>
                      <option value="location.request">location.request</option>
                    </select>
                    <select
                      aria-label="Pending work priority"
                      className="deckgo-input deck-ui-nodes-input"
                      onChange={(event) =>
                        setPendingPriority(event.target.value as DeckGoNodePendingWorkPriority)
                      }
                      value={pendingPriority}
                    >
                      <option value="normal">normal</option>
                      <option value="high">high</option>
                    </select>
                    <label className="deckgo-checkbox-row deck-ui-nodes-check">
                      <input
                        checked={pendingWake}
                        onChange={(event) => setPendingWake(event.target.checked)}
                        type="checkbox"
                      />
                      <span>wake if offline</span>
                    </label>
                  </div>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <button
                      className="deckgo-button deck-ui-nodes-button"
                      disabled={actionState !== "idle"}
                      onClick={() => void enqueuePendingWorkAction()}
                      type="button"
                    >
                      {actionState === "enqueueing" ? "Queueing" : "Queue pending work"}
                    </button>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-nodes-surface-grid">
                  <div className="deckgo-surface-tile deck-ui-nodes-surface">
                    <p className="deckgo-surface-label">Capabilities</p>
                    {selectedNode.caps.length > 0 ? (
                      <div className="deckgo-pill-row deck-ui-nodes-status-row">
                        {selectedNode.caps.map((capability) => (
                          <span className="deckgo-pill" key={capability}>
                            {capability}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="deckgo-note deck-ui-nodes-empty">No capabilities reported.</p>
                    )}
                  </div>
                  <div className="deckgo-surface-tile deck-ui-nodes-surface">
                    <p className="deckgo-surface-label">Commands</p>
                    {selectedNode.commands.length > 0 ? (
                      <div className="deckgo-pill-row deck-ui-nodes-status-row">
                        {selectedNode.commands.map((command) => (
                          <span className="deckgo-pill" key={command}>
                            {command}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="deckgo-note deck-ui-nodes-empty">No commands reported.</p>
                    )}
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">Permissions</p>
                  {selectedPermissions.length > 0 ? (
                    <div className="deckgo-pill-row deck-ui-nodes-status-row">
                      {selectedPermissions.map(([permission, enabled]) => (
                        <span
                          className={`deckgo-pill ${enabled ? "is-positive" : "is-muted"}`}
                          key={permission}
                        >
                          {permission}: {enabled ? "allowed" : "denied"}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="deckgo-note deck-ui-nodes-empty">No permissions reported.</p>
                  )}
                </div>
                <JsonDetails title="Node payload" payload={selectedNode} />
                {selectedRequest ? (
                  <JsonDetails title="Pairing request" payload={selectedRequest} />
                ) : null}
              </>
            ) : selectedRequest ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-nodes-hero">
                  <div>
                    <p className="deckgo-kicker">Pairing request</p>
                    <strong>{selectedRequest.displayName || selectedRequest.nodeId}</strong>
                    <p className="deckgo-note">request: {selectedRequest.requestId}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-nodes-status-row">
                    <span className="deckgo-pill">
                      {selectedRequest.isRepair ? "repair" : "pending"}
                    </span>
                    <span className="deckgo-pill">{selectedRequest.platform || "unknown"}</span>
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">Pairing action</p>
                  <p className="deckgo-note">
                    This pairing request is not present in node inventory yet, so only
                    request-scoped approve/reject actions are available.
                  </p>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <button
                      className="deckgo-button is-primary deck-ui-nodes-button"
                      type="button"
                      onClick={() => void pairingAction("approve")}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "approving" ? "Approving" : "Approve pairing"}
                    </button>
                    <button
                      className="deckgo-button is-danger deck-ui-nodes-button"
                      type="button"
                      onClick={() => void pairingAction("reject")}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "rejecting" ? "Rejecting" : "Reject pairing"}
                    </button>
                  </div>
                </div>
                <JsonDetails title="Pairing request" payload={selectedRequest} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-nodes-empty">
                Choose a node or pairing request to inspect it.
              </p>
            )}
            {actionResult ? <JsonDetails title="Last node action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
