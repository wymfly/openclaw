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
import "./nodes-panel.css";

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
    <section className="nodes-panel" data-testid="nodes-panel">
      <div className="nodes-panel__column">
        <article className="nodes-panel__card">
          <div className="nodes-panel__card-head">
            <h2 className="nodes-panel__card-title">{t("nodesList")}</h2>
          </div>
          <p className="nodes-panel__description">{t("managementDescription")}</p>
          <div className="nodes-panel__body">
            <div className="nodes-panel__pill-row">
              <span
                className={`nodes-panel__pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}
              >
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="nodes-panel__pill">{t("nodeCount", { count: nodes.length })}</span>
              <span className="nodes-panel__pill">
                {t("pendingCount", { count: pending.length })}
              </span>
            </div>
            <div className="nodes-panel__metrics">
              <ShellStat label={t("nodesStat")} value={nodes.length} />
              <ShellStat label={t("pendingRequests")} value={pending.length} />
            </div>
            <div className="nodes-panel__actions">
              <button
                className="nodes-panel__button"
                type="button"
                onClick={() => void refresh(selectedNodeId)}
              >
                {t("refreshNodes")}
              </button>
            </div>
            {error ? <p className="nodes-panel__error">{error}</p> : null}
            {pending.length > 0 ? (
              <div className="nodes-panel__surface">
                <p className="nodes-panel__label">{t("pendingPairing")}</p>
                <ul className="nodes-panel__list">
                  {pending.map((request) => (
                    <li key={request.requestId}>
                      <button
                        type="button"
                        className={`nodes-panel__row ${selectedRequest?.requestId === request.requestId ? "is-selected" : ""}`}
                        onClick={() => setSelectedNodeId(request.nodeId)}
                      >
                        <strong>{request.displayName || request.nodeId}</strong>
                        <div className="nodes-panel__meta">
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
              <p className="nodes-panel__empty">{t("emptyDescription")}</p>
            ) : (
              <ul className="nodes-panel__list">
                {nodes.map((node) => (
                  <li key={node.nodeId}>
                    <button
                      type="button"
                      className={`nodes-panel__row ${selectedNode?.nodeId === node.nodeId ? "is-selected" : ""}`}
                      onClick={() => setSelectedNodeId(node.nodeId)}
                    >
                      <strong>{node.displayName || node.nodeId}</strong>
                      <div className="nodes-panel__meta">
                        {t("platform")}: {node.platform || t("notAvailable")} | {t("connected")}:{" "}
                        {node.connected ? t("yes") : t("no")}
                      </div>
                      <div className="nodes-panel__meta">
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

      <div className="nodes-panel__column nodes-panel__column--main">
        <article className="nodes-panel__card">
          <div className="nodes-panel__card-head">
            <h2 className="nodes-panel__card-title">{t("selectedNode")}</h2>
          </div>
          <p className="nodes-panel__description">{t("selectedNodeDescription")}</p>
          <div className="nodes-panel__body">
            {selectedNode ? (
              <>
                <div className="nodes-panel__hero">
                  <div>
                    <p className="nodes-panel__eyebrow">{t("node")}</p>
                    <strong>{selectedNode.displayName || selectedNode.nodeId}</strong>
                    <p className="nodes-panel__meta">
                      {selectedNode.platform || t("unknownPlatform")}
                    </p>
                  </div>
                  <div className="nodes-panel__pill-row">
                    <span className="nodes-panel__pill">
                      {selectedNode.connected ? t("connected") : t("offline")}
                    </span>
                    <span className="nodes-panel__pill">
                      {selectedNode.paired ? t("paired") : t("unpaired")}
                    </span>
                  </div>
                </div>
                <div className="nodes-panel__detail-metrics">
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
                  <div className="nodes-panel__surface">
                    <div className="nodes-panel__pill-row">
                      <span
                        className={`nodes-panel__pill ${
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
                    <p className="nodes-panel__meta">{t(lifecycle.descriptionKey)}</p>
                    <p className="nodes-panel__meta">
                      {t("lifecycleNextStepLabel")}: {t(lifecycle.nextStepKey)}
                    </p>
                  </div>
                ) : null}
                <div className="nodes-panel__actions">
                  <input
                    className="nodes-panel__input"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    placeholder={t("renamePlaceholder")}
                    aria-label={t("nodeDisplayName")}
                  />
                  <button
                    className="nodes-panel__button"
                    type="button"
                    onClick={() => void renameAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "renaming" ? t("renaming") : t("rename")}
                  </button>
                  {selectedRequest ? (
                    <>
                      <button
                        className="nodes-panel__button is-primary"
                        type="button"
                        onClick={() => void pairingAction("approve")}
                        disabled={actionState !== "idle"}
                      >
                        {actionState === "approving" ? t("approving") : t("approvePairing")}
                      </button>
                      <button
                        className="nodes-panel__button is-danger"
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
                      className="nodes-panel__button"
                      type="button"
                      onClick={() => void requestPairingAction()}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "requesting" ? t("requesting") : t("requestPairing")}
                    </button>
                  ) : null}
                </div>
                <div className="nodes-panel__actions">
                  <input
                    className="nodes-panel__input"
                    value={verifyToken}
                    onChange={(event) => setVerifyToken(event.target.value)}
                    placeholder={t("pairingTokenPlaceholder")}
                    aria-label={t("pairingTokenLabel")}
                  />
                  <button
                    className="nodes-panel__button"
                    type="button"
                    onClick={() => void verifyPairingAction()}
                    disabled={actionState !== "idle" || !verifyToken.trim()}
                  >
                    {actionState === "verifying" ? t("verifying") : t("verifyPairing")}
                  </button>
                </div>
                <div className="nodes-panel__surface">
                  <p className="nodes-panel__label">{t("invokeNodeCommand")}</p>
                  <p className="nodes-panel__meta">{t("invokeDescription")}</p>
                  <div className="nodes-panel__actions">
                    <select
                      aria-label={t("nodeCommand")}
                      className="nodes-panel__input"
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
                      className="nodes-panel__input"
                      onChange={(event) => setInvokeTimeoutMs(event.target.value)}
                      placeholder={t("timeoutMs")}
                      value={invokeTimeoutMs}
                    />
                  </div>
                  <textarea
                    aria-label={t("nodeInvokeParamsJson")}
                    className="nodes-panel__textarea"
                    onChange={(event) => setInvokeParamsJson(event.target.value)}
                    rows={4}
                    value={invokeParamsJson}
                  />
                  <div className="nodes-panel__actions">
                    <button
                      className="nodes-panel__button is-primary"
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
                <div className="nodes-panel__surface">
                  <p className="nodes-panel__label">{t("pendingWork")}</p>
                  <p className="nodes-panel__meta">{t("pendingWorkDescription")}</p>
                  <div className="nodes-panel__actions">
                    <select
                      aria-label={t("pendingWorkType")}
                      className="nodes-panel__input"
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
                      className="nodes-panel__input"
                      onChange={(event) =>
                        setPendingPriority(event.target.value as DeckGoNodePendingWorkPriority)
                      }
                      value={pendingPriority}
                    >
                      <option value="normal">normal</option>
                      <option value="high">high</option>
                    </select>
                    <label className="nodes-panel__check">
                      <input
                        checked={pendingWake}
                        onChange={(event) => setPendingWake(event.target.checked)}
                        type="checkbox"
                      />
                      <span>{t("wakeIfOffline")}</span>
                    </label>
                  </div>
                  <div className="nodes-panel__actions">
                    <button
                      className="nodes-panel__button"
                      disabled={actionState !== "idle"}
                      onClick={() => void enqueuePendingWorkAction()}
                      type="button"
                    >
                      {actionState === "enqueueing" ? t("queueing") : t("queuePendingWork")}
                    </button>
                  </div>
                </div>
                <div className="nodes-panel__surface-grid">
                  <div className="nodes-panel__surface">
                    <p className="nodes-panel__label">{t("capabilities")}</p>
                    {selectedNode.caps.length > 0 ? (
                      <div className="nodes-panel__pill-row">
                        {selectedNode.caps.map((capability) => (
                          <span className="nodes-panel__pill" key={capability}>
                            {capability}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="nodes-panel__empty">{t("noCapabilities")}</p>
                    )}
                  </div>
                  <div className="nodes-panel__surface">
                    <p className="nodes-panel__label">{t("commands")}</p>
                    {selectedNode.commands.length > 0 ? (
                      <div className="nodes-panel__pill-row">
                        {selectedNode.commands.map((command) => (
                          <span className="nodes-panel__pill" key={command}>
                            {command}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="nodes-panel__empty">{t("noCommands")}</p>
                    )}
                  </div>
                </div>
                <div className="nodes-panel__surface">
                  <p className="nodes-panel__label">{t("permissions")}</p>
                  {selectedPermissions.length > 0 ? (
                    <div className="nodes-panel__pill-row">
                      {selectedPermissions.map(([permission, enabled]) => (
                        <span
                          className={`nodes-panel__pill ${enabled ? "is-positive" : "is-muted"}`}
                          key={permission}
                        >
                          {permission}: {enabled ? t("allowed") : t("denied")}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="nodes-panel__empty">{t("noPermissions")}</p>
                  )}
                </div>
                <JsonDetails title={t("nodePayload")} payload={selectedNode} />
                {selectedRequest ? (
                  <JsonDetails title={t("pairingRequest")} payload={selectedRequest} />
                ) : null}
              </>
            ) : selectedRequest ? (
              <>
                <div className="nodes-panel__hero">
                  <div>
                    <p className="nodes-panel__eyebrow">{t("pairingRequest")}</p>
                    <strong>{selectedRequest.displayName || selectedRequest.nodeId}</strong>
                    <p className="nodes-panel__meta">
                      {t("request")}: {selectedRequest.requestId}
                    </p>
                  </div>
                  <div className="nodes-panel__pill-row">
                    <span className="nodes-panel__pill">
                      {selectedRequest.isRepair ? t("repair") : t("requestKindPending")}
                    </span>
                    <span className="nodes-panel__pill">
                      {selectedRequest.platform || t("unknown")}
                    </span>
                  </div>
                </div>
                <div className="nodes-panel__surface">
                  <p className="nodes-panel__label">{t("pairingAction")}</p>
                  <p className="nodes-panel__meta">{t("orphanPairingDescription")}</p>
                  <div className="nodes-panel__actions">
                    <button
                      className="nodes-panel__button is-primary"
                      type="button"
                      onClick={() => void pairingAction("approve")}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "approving" ? t("approving") : t("approvePairing")}
                    </button>
                    <button
                      className="nodes-panel__button is-danger"
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
              <p className="nodes-panel__empty">{t("chooseNodeOrPairing")}</p>
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
