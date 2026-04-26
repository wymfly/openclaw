import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoApprovalPolicy,
  DeckGoApprovalPolicyDefaults,
  DeckGoApprovalPolicyResponse,
  DeckGoPendingApproval,
  DeckGoPendingApprovalsResponse,
  DeckGoPluginApprovalEntry,
  DeckGoPluginApprovalsResponse,
  DeckGoServerEvent,
} from "../../../api";
import {
  fetchApprovalsPolicy,
  fetchPendingApprovals,
  fetchPluginApprovals,
  resolveApproval,
  resolvePluginApproval,
  streamEvents,
  updateApprovalsPolicy,
} from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type ApprovalDecision = "allow-once" | "allow-always" | "deny";
type ApprovalSurface = "exec" | "plugins";
type ExecSecurity = NonNullable<DeckGoApprovalPolicyDefaults["security"]>;
type ExecAsk = NonNullable<DeckGoApprovalPolicyDefaults["ask"]>;

const SECURITY_OPTIONS: ExecSecurity[] = ["deny", "allowlist", "full"];
const ASK_OPTIONS: ExecAsk[] = ["off", "on-miss", "always"];

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

function isExecSecurity(value: unknown): value is ExecSecurity {
  return typeof value === "string" && SECURITY_OPTIONS.includes(value as ExecSecurity);
}

function isExecAsk(value: unknown): value is ExecAsk {
  return typeof value === "string" && ASK_OPTIONS.includes(value as ExecAsk);
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

function readStreamPayload(event: DeckGoServerEvent): Record<string, unknown> | null {
  const jsonPayload = readRecord(event.json);
  if (jsonPayload) {
    return jsonPayload;
  }
  if (!event.data) {
    return null;
  }
  try {
    return readRecord(JSON.parse(event.data));
  } catch {
    return null;
  }
}

function readPendingApproval(event: DeckGoServerEvent): DeckGoPendingApproval | null {
  const payload = readStreamPayload(event);
  if (!payload) {
    return null;
  }
  const { id, command, createdAtMs, expiresAtMs } = payload;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof command !== "string" ||
    typeof createdAtMs !== "number" ||
    typeof expiresAtMs !== "number"
  ) {
    return null;
  }
  return {
    id,
    command,
    commandArgv: Array.isArray(payload.commandArgv)
      ? payload.commandArgv.filter((item): item is string => typeof item === "string")
      : undefined,
    agentId: typeof payload.agentId === "string" ? payload.agentId : undefined,
    sessionKey: typeof payload.sessionKey === "string" ? payload.sessionKey : undefined,
    runId: typeof payload.runId === "string" ? payload.runId : undefined,
    cwd: typeof payload.cwd === "string" ? payload.cwd : undefined,
    createdAtMs,
    expiresAtMs,
  };
}

function readResolvedApprovalId(event: DeckGoServerEvent): string | null {
  const payload = readStreamPayload(event);
  const id = payload?.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function addPendingApproval(
  response: DeckGoPendingApprovalsResponse | null,
  approval: DeckGoPendingApproval,
): DeckGoPendingApprovalsResponse | null {
  if (filterActivePendingApprovals([approval]).length === 0) {
    return response;
  }
  const pending = filterActivePendingApprovals(response?.pending ?? []);
  if (pending.some((entry) => entry.id === approval.id)) {
    return response ? { ...response, pending } : { pending };
  }
  return {
    ...response,
    pending: [...pending, approval],
  };
}

function removePendingApproval(
  response: DeckGoPendingApprovalsResponse | null,
  id: string,
): DeckGoPendingApprovalsResponse | null {
  if (!response) {
    return response;
  }
  return {
    ...response,
    pending: (response.pending ?? []).filter((approval) => approval.id !== id),
  };
}

function normalizePluginApprovals(
  response: DeckGoPluginApprovalsResponse | null,
): DeckGoPluginApprovalEntry[] {
  if (!response) {
    return [];
  }
  return Array.isArray(response) ? response : (response.entries ?? []);
}

function isPluginApprovalExpired(approval: DeckGoPluginApprovalEntry, now = Date.now()) {
  return Number.isFinite(approval.expiresAtMs) && Number(approval.expiresAtMs) <= now;
}

function formatOptionalDate(value: number | undefined) {
  return Number.isFinite(value) ? new Date(Number(value)).toLocaleString() : "n/a";
}

function setDefaultsSelectValue(
  defaults: DeckGoApprovalPolicyDefaults,
  key: "security" | "ask" | "askFallback",
  value: string,
) {
  const next = { ...defaults };
  if (!value) {
    delete next[key];
    return next;
  }
  if (key === "ask" && isExecAsk(value)) {
    next.ask = value;
  } else if ((key === "security" || key === "askFallback") && isExecSecurity(value)) {
    next[key] = value;
  }
  return next;
}

function setDefaultsAutoAllowSkills(defaults: DeckGoApprovalPolicyDefaults, checked: boolean) {
  const next = { ...defaults };
  if (checked) {
    next.autoAllowSkills = true;
  } else {
    delete next.autoAllowSkills;
  }
  return next;
}

function PolicyDefaultsControls({
  label,
  defaults,
  onChange,
}: {
  label: string;
  defaults: DeckGoApprovalPolicyDefaults;
  onChange: (defaults: DeckGoApprovalPolicyDefaults) => void;
}) {
  return (
    <div className="deckgo-form-grid deck-ui-approvals-policy-grid">
      <label className="deckgo-form-row">
        <span>Security</span>
        <select
          aria-label={`${label} security`}
          className="deckgo-input deck-ui-approvals-input"
          value={defaults.security ?? ""}
          onChange={(event) =>
            onChange(setDefaultsSelectValue(defaults, "security", event.target.value))
          }
        >
          <option value="">inherit</option>
          {SECURITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="deckgo-form-row">
        <span>Ask mode</span>
        <select
          aria-label={`${label} ask`}
          className="deckgo-input deck-ui-approvals-input"
          value={defaults.ask ?? ""}
          onChange={(event) =>
            onChange(setDefaultsSelectValue(defaults, "ask", event.target.value))
          }
        >
          <option value="">inherit</option>
          {ASK_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="deckgo-form-row">
        <span>Ask fallback</span>
        <select
          aria-label={`${label} ask fallback`}
          className="deckgo-input deck-ui-approvals-input"
          value={defaults.askFallback ?? ""}
          onChange={(event) =>
            onChange(setDefaultsSelectValue(defaults, "askFallback", event.target.value))
          }
        >
          <option value="">inherit</option>
          {SECURITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="deckgo-checkbox-row">
        <input
          aria-label={`${label} auto allow skills`}
          type="checkbox"
          checked={defaults.autoAllowSkills === true}
          onChange={(event) => onChange(setDefaultsAutoAllowSkills(defaults, event.target.checked))}
        />
        <span>Auto allow skills</span>
      </label>
    </div>
  );
}

export function ApprovalsPanel() {
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

  useEffect(() => {
    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      retryDelayMs: 1_000,
      onEvent(event) {
        if (event.event === "approval.pending") {
          const approval = readPendingApproval(event);
          if (!approval) {
            return;
          }
          setPendingResponse((current) => addPendingApproval(current, approval));
          setSelectedApprovalId((current) => current || approval.id);
          return;
        }
        if (event.event === "approval.resolved") {
          const id = readResolvedApprovalId(event);
          if (!id) {
            return;
          }
          setPendingResponse((current) => removePendingApproval(current, id));
          setSelectedApprovalId((current) => (current === id ? "" : current));
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, []);

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
            {surface === "exec" && pendingApprovals.length === 0 ? (
              <p className="deckgo-note deck-ui-approvals-empty">No pending approvals.</p>
            ) : null}
            {surface === "exec" && pendingApprovals.length > 0 ? (
              <ul className="deckgo-shell-list deck-ui-approvals-list">
                {pendingApprovals.map((approval) => (
                  <li key={approval.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-approvals-row ${selectedApproval?.id === approval.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedApprovalId(approval.id)}
                    >
                      <strong>{approval.command}</strong>
                      <div className="deckgo-meta">
                        id: {approval.id} | agent: {approval.agentId || "n/a"} | session:{" "}
                        {approval.sessionKey || "n/a"}
                      </div>
                      <div className="deckgo-meta">
                        expires: {new Date(approval.expiresAtMs).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {surface === "plugins" && pluginApprovals.length === 0 ? (
              <p className="deckgo-note deck-ui-approvals-empty">No plugin approvals.</p>
            ) : null}
            {surface === "plugins" && pluginApprovals.length > 0 ? (
              <ul className="deckgo-shell-list deck-ui-approvals-list">
                {pluginApprovals.map((approval) => {
                  const expired = isPluginApprovalExpired(approval);
                  return (
                    <li key={approval.id}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card deck-ui-approvals-row ${selectedPluginApproval?.id === approval.id ? "is-selected" : ""}`}
                        onClick={() => setSelectedPluginApprovalId(approval.id)}
                      >
                        <strong>{approval.pluginId || approval.id}</strong>
                        <div className="deckgo-meta">
                          id: {approval.id} | status: {approval.status || "pending"} | decision:{" "}
                          {approval.decision || (expired ? "expired" : "pending")}
                        </div>
                        <div className="deckgo-meta">
                          command: {approval.command || "n/a"} | expires:{" "}
                          {formatOptionalDate(approval.expiresAtMs)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-approvals-column deck-ui-approvals-detail-column">
        <article className="deckgo-card is-float deck-ui-approvals-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected approval</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Inspect exec/plugin approval requests, inspect policy, and take direct allow/deny
            actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-approvals-body">
            {surface === "plugins" && selectedPluginApproval ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-approvals-hero">
                  <div>
                    <p className="deckgo-kicker">Plugin approval</p>
                    <strong>{selectedPluginApproval.pluginId || selectedPluginApproval.id}</strong>
                    <p className="deckgo-note">id: {selectedPluginApproval.id}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      status {selectedPluginApproval.status || "pending"}
                    </span>
                    <span className="deckgo-pill">
                      decision {selectedPluginApproval.decision || "pending"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-approvals-detail-stats">
                  <ShellStat
                    label="created"
                    value={formatOptionalDate(selectedPluginApproval.createdAtMs)}
                  />
                  <ShellStat
                    label="expires"
                    value={formatOptionalDate(selectedPluginApproval.expiresAtMs)}
                  />
                </div>
                <div className="deck-ui-approvals-details">
                  <JsonDetails title="Plugin approval payload" payload={selectedPluginApproval} />
                </div>
              </>
            ) : null}
            {surface === "exec" && selectedApproval ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-approvals-hero">
                  <div>
                    <p className="deckgo-kicker">Command</p>
                    <strong>{selectedApproval.command}</strong>
                    <p className="deckgo-note">run: {selectedApproval.runId || "n/a"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">agent {selectedApproval.agentId || "n/a"}</span>
                    <span className="deckgo-pill">
                      session {selectedApproval.sessionKey || "n/a"}
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
                      Open approval agent
                    </button>
                  ) : null}
                  {selectedApproval.sessionKey ? (
                    <button
                      className="deckgo-button deck-ui-approvals-button"
                      type="button"
                      onClick={() => navigateToSession(ui, selectedApproval.sessionKey)}
                    >
                      Open approval session
                    </button>
                  ) : null}
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-approvals-detail-stats">
                  <ShellStat
                    label="created"
                    value={new Date(selectedApproval.createdAtMs).toLocaleString()}
                  />
                  <ShellStat
                    label="expires"
                    value={new Date(selectedApproval.expiresAtMs).toLocaleString()}
                  />
                </div>
                <div className="deck-ui-approvals-details">
                  <JsonDetails title="Approval payload" payload={selectedApproval} />
                </div>
              </>
            ) : null}
            {surface === "exec" && !selectedApproval ? (
              <p className="deckgo-note">Choose a pending approval to inspect it.</p>
            ) : null}
            {surface === "plugins" && !selectedPluginApproval ? (
              <p className="deckgo-note">Choose a plugin approval to inspect it.</p>
            ) : null}
            {policy ? (
              <div className="deck-ui-approvals-details">
                <JsonDetails title="Policy payload" payload={policy} />
              </div>
            ) : null}
            <div className="deckgo-surface-tile deck-ui-approvals-surface">
              <p className="deckgo-surface-label">Approval policy editor</p>
              {structuredPolicyDraft ? (
                <>
                  <p className="deckgo-kicker">Global defaults</p>
                  <PolicyDefaultsControls
                    label="global"
                    defaults={structuredPolicyDraft.defaults}
                    onChange={(defaults) =>
                      updatePolicyDraft({ ...structuredPolicyDraft, defaults })
                    }
                  />

                  <p className="deckgo-kicker deck-ui-approvals-section-title">
                    Per-agent overrides
                  </p>
                  {Object.entries(structuredPolicyDraft.agents).length > 0 ? (
                    <div className="deckgo-shell-list deck-ui-approvals-agent-list">
                      {Object.entries(structuredPolicyDraft.agents).map(
                        ([agentId, agentDefaults]) => (
                          <div
                            key={agentId}
                            className="deckgo-selectable-card deck-ui-approvals-policy-card"
                          >
                            <div className="deckgo-card-header">
                              <strong>{agentId}</strong>
                              <button
                                className="deckgo-button deck-ui-approvals-button is-danger"
                                type="button"
                                onClick={() => removeAgentOverride(agentId)}
                              >
                                Remove
                              </button>
                            </div>
                            <PolicyDefaultsControls
                              label={`agent ${agentId}`}
                              defaults={agentDefaults}
                              onChange={(defaults) =>
                                updatePolicyDraft({
                                  ...structuredPolicyDraft,
                                  agents: {
                                    ...structuredPolicyDraft.agents,
                                    [agentId]: defaults,
                                  },
                                })
                              }
                            />
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="deckgo-note">No agent overrides.</p>
                  )}
                  <div className="deckgo-actions deck-ui-approvals-actions">
                    <input
                      aria-label="new approval agent id"
                      className="deckgo-input deck-ui-approvals-input"
                      value={newAgentId}
                      onChange={(event) => setNewAgentId(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addAgentOverride();
                        }
                      }}
                      placeholder="agent id"
                    />
                    <button
                      className="deckgo-button deck-ui-approvals-button"
                      type="button"
                      onClick={addAgentOverride}
                      disabled={!newAgentId.trim()}
                    >
                      Add agent
                    </button>
                  </div>

                  <p className="deckgo-kicker deck-ui-approvals-section-title">Path allowlist</p>
                  {structuredPolicyDraft.allowlist.length > 0 ? (
                    <div className="deckgo-pill-row deck-ui-approvals-allowlist-row">
                      {structuredPolicyDraft.allowlist.map((path) => (
                        <span key={path} className="deckgo-pill">
                          <code>{path}</code>
                          <button
                            className="deckgo-button deck-ui-approvals-button is-danger"
                            type="button"
                            onClick={() => removeAllowlistPath(path)}
                          >
                            Remove
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="deckgo-note">No allowlisted paths.</p>
                  )}
                  <div className="deckgo-actions deck-ui-approvals-actions deck-ui-approvals-actions-bottom">
                    <input
                      aria-label="new approval allowlist path"
                      className="deckgo-input deck-ui-approvals-input"
                      value={newAllowlistPath}
                      onChange={(event) => setNewAllowlistPath(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addAllowlistPath();
                        }
                      }}
                      placeholder="/path/to/allow"
                    />
                    <button
                      className="deckgo-button deck-ui-approvals-button"
                      type="button"
                      onClick={addAllowlistPath}
                      disabled={!newAllowlistPath.trim()}
                    >
                      Add path
                    </button>
                  </div>
                </>
              ) : (
                <p className="deckgo-note">
                  Policy JSON is invalid, so structured controls are paused until it parses.
                </p>
              )}
              <textarea
                aria-label="approval policy json"
                className="deckgo-textarea deck-ui-approvals-textarea"
                value={policyDraft}
                onChange={(event) => setPolicyDraft(event.target.value)}
                rows={12}
              />
              <div className="deckgo-actions deck-ui-approvals-actions deck-ui-approvals-actions-offset">
                <button
                  className="deckgo-button deck-ui-approvals-button is-primary"
                  type="button"
                  onClick={() => void savePolicyDraft()}
                  disabled={policySaveState !== "idle" || !policyDraft.trim()}
                >
                  {policySaveState === "saving" ? "Saving policy" : "Save policy"}
                </button>
              </div>
            </div>
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
