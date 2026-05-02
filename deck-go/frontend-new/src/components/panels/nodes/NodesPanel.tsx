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
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";

type NodeLifecycleSummary = {
  tone: "success" | "warning" | "neutral";
  titleKey: string;
  descriptionKey: string;
  nextStepKey: string;
};

function getNodeLifecycleSummary(
  node: DeckGoNodeSummary,
  pendingRequest: DeckGoPairingRequest | null,
): NodeLifecycleSummary {
  if (pendingRequest?.isRepair) {
    return {
      tone: "warning",
      titleKey: "lifecycleRepairTitle",
      descriptionKey: "lifecycleRepairDescription",
      nextStepKey: "lifecycleRepairNextStep",
    };
  }
  if (pendingRequest) {
    return {
      tone: "warning",
      titleKey: "lifecyclePendingTitle",
      descriptionKey: "lifecyclePendingDescription",
      nextStepKey: "lifecyclePendingNextStep",
    };
  }
  if (node.connected && node.paired) {
    return {
      tone: "success",
      titleKey: "lifecycleConnectedTitle",
      descriptionKey: "lifecycleConnectedDescription",
      nextStepKey: "lifecycleConnectedNextStep",
    };
  }
  if (node.paired) {
    return {
      tone: "warning",
      titleKey: "lifecycleOfflineTitle",
      descriptionKey: "lifecycleOfflineDescription",
      nextStepKey: "lifecycleOfflineNextStep",
    };
  }
  return {
    tone: "neutral",
    titleKey: "lifecycleUnpairedTitle",
    descriptionKey: "lifecycleUnpairedDescription",
    nextStepKey: "lifecycleUnpairedNextStep",
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
  const t = useTranslations("nodes");
  const tc = useTranslations("common");
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
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
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
        setError(loadError instanceof Error ? loadError.message : t("describeFailed"));
      })
      .finally(() => setActionState("idle"));
  }, [nodeDetails, nodes, selectedNodeId, t]);

  const selectedNode = selectedNodeId
    ? (nodeDetails[selectedNodeId] ?? nodes.find((node) => node.nodeId === selectedNodeId) ?? null)
    : (nodes[0] ?? null);
  const selectedRequest = selectedNodeId
    ? (pending.find((request) => request.nodeId === selectedNodeId) ?? null)
    : null;
  const lifecycle = selectedNode ? getNodeLifecycleSummary(selectedNode, selectedRequest) : null;
  const selectedPermissions = selectedNode
    ? Object.entries(selectedNode.permissions ?? {})
        .slice()
        .toSorted(([left], [right]) => left.localeCompare(right))
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
      setError(actionError instanceof Error ? actionError.message : t("renameFailed"));
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
      !window.confirm(
        t("confirmInvoke", { command: selectedInvokeCommand, nodeId: selectedNode.nodeId }),
      )
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
          : t("invalidInvokeParams"),
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
      setError(actionError instanceof Error ? actionError.message : t("invokeFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const enqueuePendingWorkAction = async () => {
    if (!selectedNode) {
      return;
    }
    if (
      !window.confirm(
        t("confirmQueuePending", { type: pendingWorkType, nodeId: selectedNode.nodeId }),
      )
    ) {
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
      setError(actionError instanceof Error ? actionError.message : t("enqueueFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const pairingAction = async (decision: "approve" | "reject") => {
    if (!selectedRequest) {
      return;
    }
    if (
      !window.confirm(
        decision === "approve"
          ? t("confirmApprovePairing", { requestId: selectedRequest.requestId })
          : t("confirmRejectPairing", { requestId: selectedRequest.requestId }),
      )
    ) {
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
      setError(actionError instanceof Error ? actionError.message : t("pairingActionFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const requestPairingAction = async () => {
    if (!selectedNode) {
      return;
    }
    if (!window.confirm(t("confirmRequestPairing", { nodeId: selectedNode.nodeId }))) {
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
      setError(actionError instanceof Error ? actionError.message : t("pairingRequestFailed"));
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
      setError(actionError instanceof Error ? actionError.message : t("pairingVerifyFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-nodes">
      <div className="deckgo-column deck-ui-nodes-column">
        <article className="deckgo-card is-float deck-ui-nodes-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("nodesList")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("managementDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-nodes-body">
            <div className="deckgo-pill-row deck-ui-nodes-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="deckgo-pill">{t("nodeCount", { count: nodes.length })}</span>
              <span className="deckgo-pill">{t("pendingCount", { count: pending.length })}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-nodes-stats">
              <ShellStat label={t("nodesStat")} value={nodes.length} />
              <ShellStat label={t("pendingRequests")} value={pending.length} />
            </div>
            <div className="deckgo-actions deck-ui-nodes-actions">
              <button
                className="deckgo-button deck-ui-nodes-button"
                type="button"
                onClick={() => void refresh(selectedNodeId)}
              >
                {t("refreshNodes")}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-nodes-error">{error}</p> : null}
            {pending.length > 0 ? (
              <div className="deckgo-surface-tile deck-ui-nodes-surface">
                <p className="deckgo-surface-label">{t("pendingPairing")}</p>
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
                          {t("request")}: {request.requestId} | {t("repair")}:{" "}
                          {request.isRepair ? t("yes") : t("no")}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {nodes.length === 0 ? (
              <p className="deckgo-note deck-ui-nodes-empty">{t("emptyDescription")}</p>
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
                        {t("platform")}: {node.platform || t("notAvailable")} | {t("connected")}:{" "}
                        {node.connected ? t("yes") : t("no")}
                      </div>
                      <div className="deckgo-meta">
                        {t("paired")}: {node.paired ? t("yes") : t("no")}
                      </div>
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
            <h2 className="deckgo-card-title">{t("selectedNode")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("selectedNodeDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-nodes-body">
            {selectedNode ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-nodes-hero">
                  <div>
                    <p className="deckgo-kicker">{t("node")}</p>
                    <strong>{selectedNode.displayName || selectedNode.nodeId}</strong>
                    <p className="deckgo-note">{selectedNode.platform || t("unknownPlatform")}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-nodes-status-row">
                    <span className="deckgo-pill">
                      {selectedNode.connected ? t("connected") : t("offline")}
                    </span>
                    <span className="deckgo-pill">
                      {selectedNode.paired ? t("paired") : t("unpaired")}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-nodes-detail-stats">
                  <ShellStat
                    label={t("version")}
                    value={selectedNode.version || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("remoteIp")}
                    value={selectedNode.remoteIp || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("coreVersion")}
                    value={selectedNode.coreVersion || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("uiVersion")}
                    value={selectedNode.uiVersion || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("deviceFamily")}
                    value={selectedNode.deviceFamily || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("model")}
                    value={selectedNode.modelIdentifier || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("connectedAt")}
                    value={formatNodeTimestamp(selectedNode.connectedAtMs)}
                  />
                  <ShellStat
                    label={t("pathEnv")}
                    value={selectedNode.pathEnv || t("notAvailable")}
                  />
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
                        {t(lifecycle.titleKey)}
                      </span>
                    </div>
                    <p className="deckgo-note">{t(lifecycle.descriptionKey)}</p>
                    <p className="deckgo-meta">
                      {t("lifecycleNextStepLabel")}: {t(lifecycle.nextStepKey)}
                    </p>
                  </div>
                ) : null}
                <div className="deckgo-actions deck-ui-nodes-actions">
                  <input
                    className="deckgo-input deck-ui-nodes-input"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    placeholder={t("renamePlaceholder")}
                    aria-label={t("nodeDisplayName")}
                  />
                  <button
                    className="deckgo-button deck-ui-nodes-button"
                    type="button"
                    onClick={() => void renameAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "renaming" ? t("renaming") : t("rename")}
                  </button>
                  {selectedRequest ? (
                    <>
                      <button
                        className="deckgo-button is-primary deck-ui-nodes-button"
                        type="button"
                        onClick={() => void pairingAction("approve")}
                        disabled={actionState !== "idle"}
                      >
                        {actionState === "approving" ? t("approving") : t("approvePairing")}
                      </button>
                      <button
                        className="deckgo-button is-danger deck-ui-nodes-button"
                        type="button"
                        onClick={() => void pairingAction("reject")}
                        disabled={actionState !== "idle"}
                      >
                        {actionState === "rejecting" ? t("rejecting") : t("rejectPairing")}
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
                      {actionState === "requesting" ? t("requesting") : t("requestPairing")}
                    </button>
                  ) : null}
                </div>
                <div className="deckgo-actions deck-ui-nodes-actions">
                  <input
                    className="deckgo-input deck-ui-nodes-input"
                    value={verifyToken}
                    onChange={(event) => setVerifyToken(event.target.value)}
                    placeholder={t("pairingTokenPlaceholder")}
                    aria-label={t("pairingTokenLabel")}
                  />
                  <button
                    className="deckgo-button deck-ui-nodes-button"
                    type="button"
                    onClick={() => void verifyPairingAction()}
                    disabled={actionState !== "idle" || !verifyToken.trim()}
                  >
                    {actionState === "verifying" ? t("verifying") : t("verifyPairing")}
                  </button>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">{t("invokeNodeCommand")}</p>
                  <p className="deckgo-note">{t("invokeDescription")}</p>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <select
                      aria-label={t("nodeCommand")}
                      className="deckgo-input deck-ui-nodes-input"
                      disabled={selectedNode.commands.length === 0}
                      onChange={(event) => setInvokeCommand(event.target.value)}
                      value={selectedInvokeCommand}
                    >
                      {selectedNode.commands.length === 0 ? (
                        <option value="">{t("noCommandsAdvertised")}</option>
                      ) : (
                        selectedNode.commands.map((command) => (
                          <option key={command} value={command}>
                            {command}
                          </option>
                        ))
                      )}
                    </select>
                    <input
                      aria-label={t("nodeInvokeTimeout")}
                      className="deckgo-input deck-ui-nodes-input"
                      onChange={(event) => setInvokeTimeoutMs(event.target.value)}
                      placeholder={t("timeoutMs")}
                      value={invokeTimeoutMs}
                    />
                  </div>
                  <textarea
                    aria-label={t("nodeInvokeParamsJson")}
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
                      {actionState === "invoking" ? t("invoking") : t("invokeCommand")}
                    </button>
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">{t("pendingWork")}</p>
                  <p className="deckgo-note">{t("pendingWorkDescription")}</p>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <select
                      aria-label={t("pendingWorkType")}
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
                      aria-label={t("pendingWorkPriority")}
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
                      <span>{t("wakeIfOffline")}</span>
                    </label>
                  </div>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <button
                      className="deckgo-button deck-ui-nodes-button"
                      disabled={actionState !== "idle"}
                      onClick={() => void enqueuePendingWorkAction()}
                      type="button"
                    >
                      {actionState === "enqueueing" ? t("queueing") : t("queuePendingWork")}
                    </button>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-nodes-surface-grid">
                  <div className="deckgo-surface-tile deck-ui-nodes-surface">
                    <p className="deckgo-surface-label">{t("capabilities")}</p>
                    {selectedNode.caps.length > 0 ? (
                      <div className="deckgo-pill-row deck-ui-nodes-status-row">
                        {selectedNode.caps.map((capability) => (
                          <span className="deckgo-pill" key={capability}>
                            {capability}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="deckgo-note deck-ui-nodes-empty">{t("noCapabilities")}</p>
                    )}
                  </div>
                  <div className="deckgo-surface-tile deck-ui-nodes-surface">
                    <p className="deckgo-surface-label">{t("commands")}</p>
                    {selectedNode.commands.length > 0 ? (
                      <div className="deckgo-pill-row deck-ui-nodes-status-row">
                        {selectedNode.commands.map((command) => (
                          <span className="deckgo-pill" key={command}>
                            {command}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="deckgo-note deck-ui-nodes-empty">{t("noCommands")}</p>
                    )}
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">{t("permissions")}</p>
                  {selectedPermissions.length > 0 ? (
                    <div className="deckgo-pill-row deck-ui-nodes-status-row">
                      {selectedPermissions.map(([permission, enabled]) => (
                        <span
                          className={`deckgo-pill ${enabled ? "is-positive" : "is-muted"}`}
                          key={permission}
                        >
                          {permission}: {enabled ? t("allowed") : t("denied")}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="deckgo-note deck-ui-nodes-empty">{t("noPermissions")}</p>
                  )}
                </div>
                <JsonDetails title={t("nodePayload")} payload={selectedNode} />
                {selectedRequest ? (
                  <JsonDetails title={t("pairingRequest")} payload={selectedRequest} />
                ) : null}
              </>
            ) : selectedRequest ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-nodes-hero">
                  <div>
                    <p className="deckgo-kicker">{t("pairingRequest")}</p>
                    <strong>{selectedRequest.displayName || selectedRequest.nodeId}</strong>
                    <p className="deckgo-note">
                      {t("request")}: {selectedRequest.requestId}
                    </p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-nodes-status-row">
                    <span className="deckgo-pill">
                      {selectedRequest.isRepair ? t("repair") : t("requestKindPending")}
                    </span>
                    <span className="deckgo-pill">{selectedRequest.platform || t("unknown")}</span>
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-nodes-surface">
                  <p className="deckgo-surface-label">{t("pairingAction")}</p>
                  <p className="deckgo-note">{t("orphanPairingDescription")}</p>
                  <div className="deckgo-actions deck-ui-nodes-actions">
                    <button
                      className="deckgo-button is-primary deck-ui-nodes-button"
                      type="button"
                      onClick={() => void pairingAction("approve")}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "approving" ? t("approving") : t("approvePairing")}
                    </button>
                    <button
                      className="deckgo-button is-danger deck-ui-nodes-button"
                      type="button"
                      onClick={() => void pairingAction("reject")}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "rejecting" ? t("rejecting") : t("rejectPairing")}
                    </button>
                  </div>
                </div>
                <JsonDetails title={t("pairingRequest")} payload={selectedRequest} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-nodes-empty">{t("chooseNodeOrPairing")}</p>
            )}
            {actionResult ? (
              <JsonDetails title={t("lastNodeAction")} payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
