import { useEffect, useState } from "react";
import type {
  DeckGoNodePendingWorkPriority,
  DeckGoNodePendingWorkType,
  DeckGoNodeSummary,
  DeckGoPairingRequest,
} from "../../../api";
import {
  useEnqueueNodePendingWorkMutation,
  useInvokeNodeCommandMutation,
  useNodeDetailQuery,
  useNodePairingMutations,
  useNodePairingQuery,
  useNodesListQuery,
  useRenameNodeMutation,
} from "../../../data/modules/nodes";
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

type PendingNodeAction =
  | {
      kind: "rename";
      danger?: false;
      title: string;
      hint: string;
      nodeId: string;
      displayName: string;
    }
  | {
      kind: "approve";
      danger?: false;
      title: string;
      hint: string;
      requestId: string;
      preferredNodeId: string;
    }
  | {
      kind: "reject";
      danger: true;
      title: string;
      hint: string;
      requestId: string;
      preferredNodeId: string;
    }
  | {
      kind: "request";
      danger?: false;
      title: string;
      hint: string;
      node: DeckGoNodeSummary;
    }
  | {
      kind: "verify";
      danger?: false;
      title: string;
      hint: string;
      nodeId: string;
      token: string;
    }
  | {
      kind: "invoke";
      danger?: false;
      title: string;
      hint: string;
      nodeId: string;
      command: string;
      params: unknown;
      timeoutMs?: number;
    }
  | {
      kind: "pending";
      danger?: false;
      title: string;
      hint: string;
      nodeId: string;
      type: DeckGoNodePendingWorkType;
      priority: DeckGoNodePendingWorkPriority;
      wake: boolean;
    };

type ActionState =
  | "idle"
  | "describing"
  | "renaming"
  | "approving"
  | "requesting"
  | "rejecting"
  | "verifying"
  | "invoking"
  | "enqueueing";

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

function formatPlatform(platform?: string) {
  const value = platform?.trim();
  return value ? value.toLowerCase() : "unknown";
}

function actionStateFor(action: PendingNodeAction): ActionState {
  switch (action.kind) {
    case "rename":
      return "renaming";
    case "approve":
      return "approving";
    case "reject":
      return "rejecting";
    case "request":
      return "requesting";
    case "verify":
      return "verifying";
    case "invoke":
      return "invoking";
    case "pending":
      return "enqueueing";
    default:
      return "idle";
  }
}

export function NodesPanel() {
  const t = useTranslations("nodes");
  const tc = useTranslations("common");
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
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [pendingAction, setPendingAction] = useState<PendingNodeAction | null>(null);
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const nodesQuery = useNodesListQuery();
  const pairingQuery = useNodePairingQuery();
  const nodes = nodesQuery.data?.nodes ?? [];
  const pending = pairingQuery.data?.pending ?? [];
  const loadState: PanelState =
    nodesQuery.isLoading || pairingQuery.isLoading ? "loading" : "ready";
  const detailQuery = useNodeDetailQuery(selectedNodeId, {
    enabled:
      Boolean(selectedNodeId) &&
      nodes.some((node) => node.nodeId === selectedNodeId) &&
      !nodeDetails[selectedNodeId],
  });
  const renameNodeMutation = useRenameNodeMutation();
  const invokeNodeCommandMutation = useInvokeNodeCommandMutation();
  const enqueueNodePendingWorkMutation = useEnqueueNodePendingWorkMutation();
  const pairingMutations = useNodePairingMutations();

  const refresh = async (preferredNodeId?: string) => {
    try {
      if (preferredNodeId) {
        setSelectedNodeId(preferredNodeId);
      }
      await Promise.all([nodesQuery.refetch(), pairingQuery.refetch()]);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
    }
  };

  useEffect(() => {
    setSelectedNodeId((current) => {
      const currentStillExists =
        current &&
        (nodes.some((node) => node.nodeId === current) ||
          pending.some((request) => request.nodeId === current));
      return currentStillExists ? current : (pending[0]?.nodeId ?? nodes[0]?.nodeId ?? "");
    });
  }, [nodes, pending]);

  useEffect(() => {
    if (!nodesQuery.error && !pairingQuery.error) {
      return;
    }
    const loadError = nodesQuery.error ?? pairingQuery.error;
    setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
  }, [nodesQuery.error, pairingQuery.error, t]);

  useEffect(() => {
    if (!detailQuery.data || !selectedNodeId) {
      return;
    }
    setNodeDetails((current) => ({ ...current, [selectedNodeId]: detailQuery.data }));
    setRenameValue(detailQuery.data.displayName || detailQuery.data.nodeId);
  }, [detailQuery.data, selectedNodeId]);

  useEffect(() => {
    if (detailQuery.error) {
      setError(
        detailQuery.error instanceof Error ? detailQuery.error.message : t("describeFailed"),
      );
    }
  }, [detailQuery.error, t]);

  const selectedNode = selectedNodeId
    ? (nodeDetails[selectedNodeId] ?? nodes.find((node) => node.nodeId === selectedNodeId) ?? null)
    : null;
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
  const connectedCount = nodes.filter((node) => node.connected).length;
  const pairedCount = nodes.filter((node) => node.paired).length;
  const actionBusy = actionState !== "idle";
  const currentName = selectedNode ? selectedNode.displayName || selectedNode.nodeId : "";
  const renameDirty = Boolean(
    selectedNode && renameValue.trim() && renameValue.trim() !== currentName,
  );
  const verifyReady = verifyToken.trim().length >= 6;

  const selectNodeId = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setPendingAction(null);
    setActionResult(null);
    setError("");
    const node = nodeDetails[nodeId] ?? nodes.find((item) => item.nodeId === nodeId);
    setRenameValue(node?.displayName || node?.nodeId || "");
  };

  const parseInvokeParams = () => {
    const raw = invokeParamsJson.trim();
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as unknown;
  };

  const queueRenameAction = () => {
    if (!selectedNode || !renameDirty) {
      return;
    }
    const displayName = renameValue.trim();
    setPendingAction({
      kind: "rename",
      title: t("confirmRenameTitle"),
      hint: t("confirmRenameHint", { displayName, nodeId: selectedNode.nodeId }),
      nodeId: selectedNode.nodeId,
      displayName,
    });
  };

  const queueInvokeAction = () => {
    if (!selectedNode || !selectedInvokeCommand) {
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
    setPendingAction({
      kind: "invoke",
      title: t("confirmInvokeTitle"),
      hint: t("confirmInvoke", {
        command: selectedInvokeCommand,
        nodeId: selectedNode.nodeId,
      }),
      nodeId: selectedNode.nodeId,
      command: selectedInvokeCommand,
      params,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    });
  };

  const queuePendingWorkAction = () => {
    if (!selectedNode) {
      return;
    }
    setPendingAction({
      kind: "pending",
      title: t("confirmQueuePendingTitle"),
      hint: t("confirmQueuePending", { type: pendingWorkType, nodeId: selectedNode.nodeId }),
      nodeId: selectedNode.nodeId,
      type: pendingWorkType,
      priority: pendingPriority,
      wake: pendingWake,
    });
  };

  const queuePairingAction = (decision: "approve" | "reject") => {
    if (!selectedRequest) {
      return;
    }
    if (decision === "approve") {
      setPendingAction({
        kind: "approve",
        title: t("confirmApprovePairingTitle"),
        hint: t("confirmApprovePairing", { requestId: selectedRequest.requestId }),
        requestId: selectedRequest.requestId,
        preferredNodeId: selectedRequest.nodeId,
      });
      return;
    }
    setPendingAction({
      kind: "reject",
      danger: true,
      title: t("confirmRejectPairingTitle"),
      hint: t("confirmRejectPairing", { requestId: selectedRequest.requestId }),
      requestId: selectedRequest.requestId,
      preferredNodeId: selectedRequest.nodeId,
    });
  };

  const queueRequestPairingAction = () => {
    if (!selectedNode) {
      return;
    }
    setPendingAction({
      kind: "request",
      title: t("confirmRequestPairingTitle"),
      hint: t("confirmRequestPairing", { nodeId: selectedNode.nodeId }),
      node: selectedNode,
    });
  };

  const queueVerifyPairingAction = () => {
    if (!selectedNode) {
      return;
    }
    const token = verifyToken.trim();
    if (token.length < 6) {
      setError(t("verifyTokenTooShort"));
      return;
    }
    setPendingAction({
      kind: "verify",
      title: t("confirmVerifyPairingTitle"),
      hint: t("confirmVerifyPairing", { nodeId: selectedNode.nodeId }),
      nodeId: selectedNode.nodeId,
      token,
    });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) {
      return;
    }
    setActionState(actionStateFor(pendingAction));
    try {
      let result: unknown;
      let refreshNodeId: string | undefined;
      switch (pendingAction.kind) {
        case "rename":
          result = await renameNodeMutation.mutateAsync({
            displayName: pendingAction.displayName,
            nodeId: pendingAction.nodeId,
          });
          refreshNodeId = pendingAction.nodeId;
          break;
        case "approve":
          result = await pairingMutations.approve.mutateAsync(pendingAction.requestId);
          refreshNodeId = pendingAction.preferredNodeId;
          break;
        case "reject":
          result = await pairingMutations.reject.mutateAsync(pendingAction.requestId);
          refreshNodeId = pendingAction.preferredNodeId;
          break;
        case "request":
          result = await pairingMutations.request.mutateAsync({
            nodeId: pendingAction.node.nodeId,
            displayName: pendingAction.node.displayName,
            platform: pendingAction.node.platform,
            version: pendingAction.node.version,
            coreVersion: pendingAction.node.coreVersion,
            uiVersion: pendingAction.node.uiVersion,
            deviceFamily: pendingAction.node.deviceFamily,
            modelIdentifier: pendingAction.node.modelIdentifier,
            caps: pendingAction.node.caps,
            commands: pendingAction.node.commands,
            remoteIp: pendingAction.node.remoteIp,
          });
          refreshNodeId = pendingAction.node.nodeId;
          break;
        case "verify":
          result = await pairingMutations.verify.mutateAsync({
            nodeId: pendingAction.nodeId,
            token: pendingAction.token,
          });
          setVerifyToken("");
          refreshNodeId = pendingAction.nodeId;
          break;
        case "invoke":
          result = await invokeNodeCommandMutation.mutateAsync({
            command: pendingAction.command,
            nodeId: pendingAction.nodeId,
            params: pendingAction.params,
            timeoutMs: pendingAction.timeoutMs,
          });
          break;
        case "pending":
          result = await enqueueNodePendingWorkMutation.mutateAsync({
            nodeId: pendingAction.nodeId,
            priority: pendingAction.priority,
            type: pendingAction.type,
            wake: pendingAction.wake,
          });
          break;
        default:
          break;
      }
      setActionResult(result);
      setError("");
      setPendingAction(null);
      if (refreshNodeId) {
        await refresh(refreshNodeId);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("actionFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const renderConfirmRow = () =>
    pendingAction ? (
      <div
        className={`nodes-panel__confirm ${pendingAction.danger ? "is-danger" : ""}`}
        role="alertdialog"
        aria-label={pendingAction.title}
      >
        <div>
          <strong>{pendingAction.title}</strong>
          <p className="nodes-panel__meta">{pendingAction.hint}</p>
        </div>
        <div className="nodes-panel__confirm-actions">
          <button
            className="nodes-panel__button"
            disabled={actionBusy}
            onClick={() => setPendingAction(null)}
            type="button"
          >
            {tc("cancel")}
          </button>
          <button
            className={`nodes-panel__button ${pendingAction.danger ? "is-danger" : "is-primary"}`}
            disabled={actionBusy}
            onClick={() => void confirmPendingAction()}
            type="button"
          >
            {actionBusy ? t("runningAction") : t("confirmAction")}
          </button>
        </div>
      </div>
    ) : null;

  const renderActionResult = () =>
    actionResult ? <JsonDetails title={t("lastNodeAction")} payload={actionResult} /> : null;

  return (
    <section className="nodes-panel" data-testid="nodes-panel">
      <div className="nodes-panel__column">
        <article className="nodes-panel__card">
          <div className="nodes-panel__card-head">
            <h2 className="nodes-panel__card-title">{t("nodesList")}</h2>
            <button
              className="nodes-panel__button"
              type="button"
              onClick={() => void refresh(selectedNodeId)}
            >
              {t("refreshNodes")}
            </button>
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
              <ShellStat label={t("connectedStat")} value={connectedCount} />
              <ShellStat label={t("pairedStat")} value={pairedCount} />
              <ShellStat label={t("pendingRequests")} value={pending.length} />
            </div>
            {error ? <p className="nodes-panel__error">{error}</p> : null}
            {pending.length > 0 ? (
              <div className="nodes-panel__surface">
                <p className="nodes-panel__label">{t("pendingPairing")}</p>
                <ul className="nodes-panel__list">
                  {pending.map((request) => {
                    const orphan = !nodes.some((node) => node.nodeId === request.nodeId);
                    return (
                      <li key={request.requestId}>
                        <button
                          type="button"
                          className={`nodes-panel__row ${selectedRequest?.requestId === request.requestId ? "is-selected" : ""}`}
                          onClick={() => selectNodeId(request.nodeId)}
                          aria-pressed={selectedRequest?.requestId === request.requestId}
                        >
                          <strong>{request.displayName || request.nodeId}</strong>
                          <div className="nodes-panel__meta">
                            {t("request")}: {request.requestId} | {t("repair")}:{" "}
                            {request.isRepair ? t("yes") : t("no")}
                          </div>
                          {orphan ? (
                            <div className="nodes-panel__meta">{t("orphanRequestHint")}</div>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
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
                      onClick={() => selectNodeId(node.nodeId)}
                      aria-pressed={selectedNode?.nodeId === node.nodeId}
                    >
                      <strong>{node.displayName || node.nodeId}</strong>
                      <div className="nodes-panel__meta">
                        {t("platform")}: {node.platform || t("notAvailable")} | {t("connected")}:{" "}
                        {node.connected ? t("yes") : t("no")}
                      </div>
                      <div className="nodes-panel__meta">
                        {t("paired")}: {node.paired ? t("yes") : t("no")}
                      </div>
                      <div className="nodes-panel__pill-row">
                        <span
                          className={`nodes-panel__pill is-platform-${formatPlatform(node.platform)}`}
                        >
                          {node.platform || t("unknown")}
                        </span>
                        {node.caps.slice(0, 2).map((capability) => (
                          <span className="nodes-panel__pill is-muted" key={capability}>
                            {capability}
                          </span>
                        ))}
                        {node.caps.length > 2 ? (
                          <span className="nodes-panel__pill is-muted">
                            +{node.caps.length - 2}
                          </span>
                        ) : null}
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
                      {selectedNode.nodeId} | {selectedNode.platform || t("unknownPlatform")}
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
                {renderConfirmRow()}
                {renderActionResult()}
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
                    onClick={queueRenameAction}
                    disabled={actionBusy || !renameDirty}
                  >
                    {actionState === "renaming" ? t("renaming") : t("rename")}
                  </button>
                  {selectedRequest ? (
                    <>
                      <button
                        className="nodes-panel__button is-primary"
                        type="button"
                        onClick={() => queuePairingAction("approve")}
                        disabled={actionBusy}
                      >
                        {actionState === "approving" ? t("approving") : t("approvePairing")}
                      </button>
                      <button
                        className="nodes-panel__button is-danger"
                        type="button"
                        onClick={() => queuePairingAction("reject")}
                        disabled={actionBusy}
                      >
                        {actionState === "rejecting" ? t("rejecting") : t("rejectPairing")}
                      </button>
                    </>
                  ) : null}
                  {!selectedRequest && !selectedNode.paired ? (
                    <button
                      className="nodes-panel__button"
                      type="button"
                      onClick={queueRequestPairingAction}
                      disabled={actionBusy}
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
                    onClick={queueVerifyPairingAction}
                    disabled={actionBusy || !verifyReady}
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
                        actionBusy || !selectedInvokeCommand || selectedNode.commands.length === 0
                      }
                      onClick={queueInvokeAction}
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
                      disabled={actionBusy}
                      onClick={queuePendingWorkAction}
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
                {renderConfirmRow()}
                {renderActionResult()}
                <div className="nodes-panel__surface">
                  <p className="nodes-panel__label">{t("pairingAction")}</p>
                  <p className="nodes-panel__meta">{t("orphanPairingDescription")}</p>
                  <div className="nodes-panel__actions">
                    <button
                      className="nodes-panel__button is-primary"
                      type="button"
                      onClick={() => queuePairingAction("approve")}
                      disabled={actionBusy}
                    >
                      {actionState === "approving" ? t("approving") : t("approvePairing")}
                    </button>
                    <button
                      className="nodes-panel__button is-danger"
                      type="button"
                      onClick={() => queuePairingAction("reject")}
                      disabled={actionBusy}
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
          </div>
        </article>
      </div>
    </section>
  );
}
