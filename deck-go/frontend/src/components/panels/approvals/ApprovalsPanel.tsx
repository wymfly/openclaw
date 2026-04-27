import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoApprovalPolicy,
  DeckGoApprovalPolicyDefaults,
  DeckGoApprovalPolicyResponse,
  DeckGoPendingApproval,
  DeckGoPendingApprovalsResponse,
  DeckGoPluginApprovalEntry,
  DeckGoPluginApprovalsResponse,
} from "../../../api";
import {
  fetchApprovalsPolicy,
  fetchPendingApprovals,
  fetchPluginApprovals,
  resolveApproval,
  resolvePluginApproval,
  updateApprovalsPolicy,
} from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { formatOptionalDate, isPluginApprovalExpired } from "./approval-model";
import { PendingList } from "./PendingList";
import { PluginApprovalList } from "./PluginApprovalList";
import { isExecAsk, isExecSecurity } from "./PolicyDefaultsControls";
import { PolicyEditor } from "./PolicyEditor";
import { useApprovalsStream } from "./useApprovalsStream";

type PanelState = "idle" | "loading" | "ready";
type ApprovalDecision = "allow-once" | "allow-always" | "deny";
type ApprovalSurface = "exec" | "plugins";

function normalizePolicy(
  response: DeckGoApprovalPolicyResponse | null,
): DeckGoApprovalPolicy | null {
  if (!response) {
    return null;
  }
  const file = response.file ?? {};
  return {
    defaults: file.defaults ?? {},
    agents: file.agents ?? {},
    allowlist: file.allowlist ?? [],
  };
}

function filterActivePendingApprovals(approvals: DeckGoPendingApproval[], now = Date.now()) {
  return approvals.filter(
    (approval) => !Number.isFinite(approval.expiresAtMs) || approval.expiresAtMs > now,
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sanitizePolicyDefaults(value: unknown): DeckGoApprovalPolicyDefaults {
  const record = readRecord(value);
  if (!record) {
    return {};
  }
  const defaults: DeckGoApprovalPolicyDefaults = {};
  if (isExecSecurity(record.security)) {
    defaults.security = record.security;
  }
  if (isExecAsk(record.ask)) {
    defaults.ask = record.ask;
  }
  if (isExecSecurity(record.askFallback)) {
    defaults.askFallback = record.askFallback;
  }
  if (record.autoAllowSkills === true) {
    defaults.autoAllowSkills = true;
  }
  return defaults;
}

function sanitizePolicyDraft(value: unknown): DeckGoApprovalPolicy | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const agentsRecord = readRecord(record.agents);
  const agents: Record<string, DeckGoApprovalPolicyDefaults> = {};
  for (const [agentId, agentDefaults] of Object.entries(agentsRecord ?? {})) {
    if (agentId.trim()) {
      agents[agentId] = sanitizePolicyDefaults(agentDefaults);
    }
  }
  return {
    defaults: sanitizePolicyDefaults(record.defaults),
    agents,
    allowlist: Array.isArray(record.allowlist)
      ? record.allowlist.filter((path): path is string => typeof path === "string" && !!path.trim())
      : [],
  };
}

function parsePolicyDraft(value: string): DeckGoApprovalPolicy | null {
  try {
    return sanitizePolicyDraft(JSON.parse(value));
  } catch {
    return null;
  }
}

function formatPolicyDraft(policy: DeckGoApprovalPolicy) {
  return JSON.stringify(policy, null, 2);
}

function normalizePluginApprovals(
  response: DeckGoPluginApprovalsResponse | null,
): DeckGoPluginApprovalEntry[] {
  if (!response) {
    return [];
  }
  return Array.isArray(response) ? response : (response.entries ?? []);
}

export function ApprovalsPanel() {
  const t = useTranslations("approvals");
  const ui = useDeckUI();
  const [policyResponse, setPolicyResponse] = useState<DeckGoApprovalPolicyResponse | null>(null);
  const [pendingResponse, setPendingResponse] = useState<DeckGoPendingApprovalsResponse | null>(
    null,
  );
  const [pluginResponse, setPluginResponse] = useState<DeckGoPluginApprovalsResponse | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [selectedPluginApprovalId, setSelectedPluginApprovalId] = useState("");
  const [surface, setSurface] = useState<ApprovalSurface>("exec");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<ApprovalDecision | "idle">("idle");
  const [policySaveState, setPolicySaveState] = useState<"idle" | "saving">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [policyDraft, setPolicyDraft] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [newAllowlistPath, setNewAllowlistPath] = useState("");
  const [error, setError] = useState("");

  const refresh = async (preferredApprovalId?: string, preferredPluginApprovalId?: string) => {
    setLoadState("loading");
    try {
      const [nextPolicy, nextPending, nextPlugins] = await Promise.all([
        fetchApprovalsPolicy(),
        fetchPendingApprovals(),
        fetchPluginApprovals(),
      ]);
      const nextPolicyDraft = normalizePolicy(nextPolicy);
      setPolicyResponse(nextPolicy);
      setPendingResponse(nextPending);
      setPluginResponse(nextPlugins);
      setPolicyDraft(
        formatPolicyDraft(nextPolicyDraft ?? { defaults: {}, agents: {}, allowlist: [] }),
      );
      setLoadState("ready");
      setError("");
      const approvals = filterActivePendingApprovals(nextPending.pending ?? []);
      const fallbackId = preferredApprovalId?.trim() || approvals[0]?.id || "";
      setSelectedApprovalId((current) =>
        fallbackId && approvals.some((approval) => approval.id === fallbackId)
          ? fallbackId
          : current && approvals.some((approval) => approval.id === current)
            ? current
            : approvals[0]?.id || "",
      );
      const pluginApprovals = normalizePluginApprovals(nextPlugins);
      const pluginFallbackId = preferredPluginApprovalId?.trim() || pluginApprovals[0]?.id || "";
      setSelectedPluginApprovalId((current) =>
        pluginFallbackId && pluginApprovals.some((approval) => approval.id === pluginFallbackId)
          ? pluginFallbackId
          : current && pluginApprovals.some((approval) => approval.id === current)
            ? current
            : pluginApprovals[0]?.id || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load approvals");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useApprovalsStream({ setPendingResponse, setSelectedApprovalId });

  const policy = useMemo(() => normalizePolicy(policyResponse), [policyResponse]);
  const pendingApprovals = useMemo(
    () => filterActivePendingApprovals(pendingResponse?.pending ?? []),
    [pendingResponse],
  );
  const pluginApprovals = useMemo(() => normalizePluginApprovals(pluginResponse), [pluginResponse]);
  const activePluginApprovals = useMemo(
    () =>
      pluginApprovals.filter(
        (approval) => !approval.decision && !isPluginApprovalExpired(approval),
      ),
    [pluginApprovals],
  );
  const selectedApproval =
    pendingApprovals.find((approval) => approval.id === selectedApprovalId) ??
    pendingApprovals[0] ??
    null;
  const selectedPluginApproval =
    pluginApprovals.find((approval) => approval.id === selectedPluginApprovalId) ??
    pluginApprovals[0] ??
    null;

  const runDecision = async (decision: ApprovalDecision) => {
    if (!selectedApproval) {
      return;
    }
    setActionState(decision);
    try {
      const result = await resolveApproval(selectedApproval.id, decision);
      setActionResult(result);
      setError("");
      await refresh(selectedApproval.id, selectedPluginApprovalId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "approval action failed");
    } finally {
      setActionState("idle");
    }
  };

  const runPluginDecision = async (decision: ApprovalDecision) => {
    if (!selectedPluginApproval) {
      return;
    }
    setActionState(decision);
    try {
      const result = await resolvePluginApproval(selectedPluginApproval.id, decision);
      setActionResult(result);
      setError("");
      await refresh(selectedApprovalId, selectedPluginApproval.id);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "plugin approval action failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const savePolicyDraft = async () => {
    setPolicySaveState("saving");
    try {
      const normalized = parsePolicyDraft(policyDraft);
      if (!normalized) {
        throw new Error("approval policy JSON is invalid");
      }
      const result = await updateApprovalsPolicy(normalized, policyResponse?.hash);
      setActionResult(result);
      setError("");
      await refresh(selectedApprovalId, selectedPluginApprovalId);
    } catch (policyError) {
      setError(policyError instanceof Error ? policyError.message : "approval policy save failed");
    } finally {
      setPolicySaveState("idle");
    }
  };

  const selectedPluginIsActionable =
    selectedPluginApproval &&
    !selectedPluginApproval.decision &&
    !isPluginApprovalExpired(selectedPluginApproval);
  const structuredPolicyDraft = useMemo(() => parsePolicyDraft(policyDraft), [policyDraft]);

  const updatePolicyDraft = (nextPolicy: DeckGoApprovalPolicy) => {
    setPolicyDraft(formatPolicyDraft(nextPolicy));
  };

  const addAgentOverride = () => {
    const agentId = newAgentId.trim();
    if (!agentId || !structuredPolicyDraft || structuredPolicyDraft.agents[agentId]) {
      return;
    }
    updatePolicyDraft({
      ...structuredPolicyDraft,
      agents: {
        ...structuredPolicyDraft.agents,
        [agentId]: {},
      },
    });
    setNewAgentId("");
  };

  const removeAgentOverride = (agentId: string) => {
    if (!structuredPolicyDraft) {
      return;
    }
    const agents = { ...structuredPolicyDraft.agents };
    delete agents[agentId];
    updatePolicyDraft({ ...structuredPolicyDraft, agents });
  };

  const addAllowlistPath = () => {
    const path = newAllowlistPath.trim();
    if (!path || !structuredPolicyDraft || structuredPolicyDraft.allowlist.includes(path)) {
      return;
    }
    updatePolicyDraft({
      ...structuredPolicyDraft,
      allowlist: [...structuredPolicyDraft.allowlist, path],
    });
    setNewAllowlistPath("");
  };

  const removeAllowlistPath = (path: string) => {
    if (!structuredPolicyDraft) {
      return;
    }
    updatePolicyDraft({
      ...structuredPolicyDraft,
      allowlist: structuredPolicyDraft.allowlist.filter((entry) => entry !== path),
    });
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-approvals">
      <div className="deckgo-column deck-ui-approvals-column">
        <article className="deckgo-card is-float deck-ui-approvals-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Pending approvals</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Approvals use the live pending, policy, plugin, and stream contracts.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-approvals-body">
            <div className="deckgo-pill-row deck-ui-approvals-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Approvals {loadState}
              </span>
              <span className="deckgo-pill">{pendingApprovals.length} pending</span>
              <span className="deckgo-pill">{activePluginApprovals.length} plugin pending</span>
              <span className="deckgo-pill">allowlist {policy?.allowlist.length ?? 0}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-approvals-stats">
              <ShellStat label="pending" value={pendingApprovals.length} />
              <ShellStat label="plugin pending" value={activePluginApprovals.length} />
              <ShellStat label="agent overrides" value={Object.keys(policy?.agents ?? {}).length} />
            </div>
            <div className="deckgo-pill-row deck-ui-approvals-tab-row">
              <button
                className={`deckgo-button deck-ui-approvals-button ${surface === "exec" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setSurface("exec")}
              >
                Exec approvals
              </button>
              <button
                className={`deckgo-button deck-ui-approvals-button ${surface === "plugins" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setSurface("plugins")}
              >
                Plugin approvals
              </button>
            </div>
            <div className="deckgo-actions deck-ui-approvals-actions">
              <button
                className="deckgo-button deck-ui-approvals-button"
                type="button"
                onClick={() => void refresh(selectedApprovalId, selectedPluginApprovalId)}
              >
                Refresh approvals
              </button>
              {surface === "exec" ? (
                <>
                  <button
                    className="deckgo-button deck-ui-approvals-button is-primary"
                    type="button"
                    onClick={() => void runDecision("allow-once")}
                    disabled={!selectedApproval || actionState !== "idle"}
                  >
                    {actionState === "allow-once" ? "Allowing" : "Allow once"}
                  </button>
                  <button
                    className="deckgo-button deck-ui-approvals-button"
                    type="button"
                    onClick={() => void runDecision("allow-always")}
                    disabled={!selectedApproval || actionState !== "idle"}
                  >
                    {actionState === "allow-always" ? "Saving" : "Allow always"}
                  </button>
                  <button
                    className="deckgo-button deck-ui-approvals-button is-danger"
                    type="button"
                    onClick={() => void runDecision("deny")}
                    disabled={!selectedApproval || actionState !== "idle"}
                  >
                    {actionState === "deny" ? "Denying" : "Deny"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="deckgo-button deck-ui-approvals-button is-primary"
                    type="button"
                    onClick={() => void runPluginDecision("allow-once")}
                    disabled={!selectedPluginIsActionable || actionState !== "idle"}
                  >
                    {actionState === "allow-once" ? "Allowing" : "Allow once"}
                  </button>
                  <button
                    className="deckgo-button deck-ui-approvals-button"
                    type="button"
                    onClick={() => void runPluginDecision("allow-always")}
                    disabled={!selectedPluginIsActionable || actionState !== "idle"}
                  >
                    {actionState === "allow-always" ? "Saving" : "Allow always"}
                  </button>
                  <button
                    className="deckgo-button deck-ui-approvals-button is-danger"
                    type="button"
                    onClick={() => void runPluginDecision("deny")}
                    disabled={!selectedPluginIsActionable || actionState !== "idle"}
                  >
                    {actionState === "deny" ? "Denying" : "Deny"}
                  </button>
                </>
              )}
            </div>
            {error ? <p className="deckgo-note deck-ui-approvals-error">{error}</p> : null}
            {surface === "exec" ? (
              <PendingList
                approvals={pendingApprovals}
                selectedApprovalId={selectedApproval?.id ?? ""}
                onSelect={setSelectedApprovalId}
              />
            ) : null}
            {surface === "plugins" ? (
              <PluginApprovalList
                approvals={pluginApprovals}
                selectedApprovalId={selectedPluginApproval?.id ?? ""}
                onSelect={setSelectedPluginApprovalId}
              />
            ) : null}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-approvals-column deck-ui-approvals-detail-column">
        <article className="deckgo-card is-float deck-ui-approvals-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected approval</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("inspectDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-approvals-body">
            {surface === "plugins" && selectedPluginApproval ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-approvals-hero">
                  <div>
                    <p className="deckgo-kicker">{t("pluginApproval")}</p>
                    <strong>{selectedPluginApproval.pluginId || selectedPluginApproval.id}</strong>
                    <p className="deckgo-note">
                      {t("id")}: {selectedPluginApproval.id}
                    </p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {t("status")}: {selectedPluginApproval.status || t("pendingBadge")}
                    </span>
                    <span className="deckgo-pill">
                      {t("decision")}: {selectedPluginApproval.decision || t("pendingBadge")}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-approvals-detail-stats">
                  <ShellStat
                    label={t("created")}
                    value={formatOptionalDate(
                      selectedPluginApproval.createdAtMs,
                      t("notAvailable"),
                    )}
                  />
                  <ShellStat
                    label={t("expires")}
                    value={formatOptionalDate(
                      selectedPluginApproval.expiresAtMs,
                      t("notAvailable"),
                    )}
                  />
                </div>
                <div className="deck-ui-approvals-details">
                  <JsonDetails
                    title={t("pluginApprovalPayload")}
                    payload={selectedPluginApproval}
                  />
                </div>
              </>
            ) : null}
            {surface === "exec" && selectedApproval ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-approvals-hero">
                  <div>
                    <p className="deckgo-kicker">{t("command")}</p>
                    <strong>{selectedApproval.command}</strong>
                    <p className="deckgo-note">
                      {t("run")}: {selectedApproval.runId || t("notAvailable")}
                    </p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {t("agent")}: {selectedApproval.agentId || t("notAvailable")}
                    </span>
                    <span className="deckgo-pill">
                      {t("session")}: {selectedApproval.sessionKey || t("notAvailable")}
                    </span>
                  </div>
                </div>
                <div className="deckgo-actions deck-ui-approvals-actions">
                  {selectedApproval.agentId ? (
                    <button
                      className="deckgo-button deck-ui-approvals-button"
                      type="button"
                      onClick={() => navigateToAgent(ui, selectedApproval.agentId)}
                    >
                      {t("openApprovalAgent")}
                    </button>
                  ) : null}
                  {selectedApproval.sessionKey ? (
                    <button
                      className="deckgo-button deck-ui-approvals-button"
                      type="button"
                      onClick={() => navigateToSession(ui, selectedApproval.sessionKey)}
                    >
                      {t("openApprovalSession")}
                    </button>
                  ) : null}
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-approvals-detail-stats">
                  <ShellStat
                    label={t("created")}
                    value={new Date(selectedApproval.createdAtMs).toLocaleString()}
                  />
                  <ShellStat
                    label={t("expires")}
                    value={new Date(selectedApproval.expiresAtMs).toLocaleString()}
                  />
                </div>
                <div className="deck-ui-approvals-details">
                  <JsonDetails title={t("approvalPayload")} payload={selectedApproval} />
                </div>
              </>
            ) : null}
            {surface === "exec" && !selectedApproval ? (
              <p className="deckgo-note">{t("choosePendingApproval")}</p>
            ) : null}
            {surface === "plugins" && !selectedPluginApproval ? (
              <p className="deckgo-note">{t("choosePluginApproval")}</p>
            ) : null}
            {policy ? (
              <div className="deck-ui-approvals-details">
                <JsonDetails title={t("policyPayload")} payload={policy} />
              </div>
            ) : null}
            <PolicyEditor
              structuredPolicyDraft={structuredPolicyDraft}
              policyDraft={policyDraft}
              newAgentId={newAgentId}
              newAllowlistPath={newAllowlistPath}
              policySaveState={policySaveState}
              onAddAgent={addAgentOverride}
              onAddAllowlistPath={addAllowlistPath}
              onPolicyDraftChange={setPolicyDraft}
              onNewAgentIdChange={setNewAgentId}
              onNewAllowlistPathChange={setNewAllowlistPath}
              onRemoveAgent={removeAgentOverride}
              onRemoveAllowlistPath={removeAllowlistPath}
              onSave={() => void savePolicyDraft()}
              onStructuredPolicyChange={updatePolicyDraft}
            />
            {actionResult ? (
              <div className="deck-ui-approvals-details">
                <JsonDetails title="Last approval action" payload={actionResult} />
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
