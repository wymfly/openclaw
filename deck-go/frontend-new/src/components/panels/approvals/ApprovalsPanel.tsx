import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoApprovalPolicy,
  DeckGoApprovalPolicyDefaults,
  DeckGoApprovalPolicyResponse,
  DeckGoPendingApproval,
  DeckGoPendingApprovalsResponse,
  DeckGoPluginApprovalEntry,
  DeckGoPluginApprovalsResponse,
} from "@/api-types";
import {
  useApprovalsPolicyQuery,
  usePendingApprovalsQuery,
  usePluginApprovalsQuery,
  useResolveApprovalMutation,
  useResolvePluginApprovalMutation,
  useUpdateApprovalsPolicyMutation,
} from "../../../data/modules/approvals";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import { formatOptionalDate, isPluginApprovalExpired } from "./approval-model";
import { ApprovalMetric } from "./ApprovalMetric";
import { isExecAsk, isExecSecurity } from "./PolicyDefaultsControls";
import { PolicyEditor } from "./PolicyEditor";
import { useApprovalsStream } from "./useApprovalsStream";
import "./approvals-panel.css";

type PanelState = "idle" | "loading" | "ready";
type ApprovalDecision = "allow-once" | "allow-always" | "deny";
type ApprovalSurface = "exec" | "plugins";
type ApprovalKindFilter = "all" | ApprovalSurface;
type DetailTab = "overview" | "argv" | "plan" | "scopes" | "source" | "activity";

type QueueEntry =
  | {
      kind: "exec";
      id: string;
      title: string;
      subtitle: string;
      createdAtMs: number;
      expiresAtMs: number;
      searchText: string;
      payload: DeckGoPendingApproval;
    }
  | {
      kind: "plugins";
      id: string;
      title: string;
      subtitle: string;
      createdAtMs?: number;
      expiresAtMs?: number;
      searchText: string;
      payload: DeckGoPluginApprovalEntry;
    };

type DecisionEvidence = {
  id: string;
  kind: "exec" | "plugin";
  title: string;
  decision: ApprovalDecision;
  actor: string;
  decidedAtMs: number;
};

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

function formatRemaining(expiresAtMs: number | undefined, nowMs: number, fallback: string) {
  if (!Number.isFinite(expiresAtMs)) {
    return fallback;
  }
  const remainingSeconds = Math.max(0, Math.ceil((Number(expiresAtMs) - nowMs) / 1000));
  if (remainingSeconds >= 60) {
    return `${Math.ceil(remainingSeconds / 60)}m`;
  }
  return `${remainingSeconds}s`;
}

function formatRelativeAge(createdAtMs: number | undefined, nowMs: number, fallback: string) {
  if (!Number.isFinite(createdAtMs)) {
    return fallback;
  }
  const ageSeconds = Math.max(0, Math.floor((nowMs - Number(createdAtMs)) / 1000));
  if (ageSeconds >= 60) {
    return `${Math.floor(ageSeconds / 60)}m ago`;
  }
  return `${ageSeconds}s ago`;
}

function normalizeSearchText(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part): part is string | number => part != null && `${part}`.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function decisionLabel(t: ReturnType<typeof useTranslations>, decision: ApprovalDecision) {
  if (decision === "allow-once") {
    return t("allowOnce");
  }
  if (decision === "allow-always") {
    return t("allowAlways");
  }
  return t("deny");
}

function recordDecisionLabel(t: ReturnType<typeof useTranslations>, decision: ApprovalDecision) {
  return decisionLabel(t, decision).toLowerCase();
}

export function ApprovalsPanel() {
  const t = useTranslations("approvals");
  const ui = useDeckUI();
  const policyQuery = useApprovalsPolicyQuery();
  const pendingQuery = usePendingApprovalsQuery();
  const pluginQuery = usePluginApprovalsQuery();
  const resolveApprovalMutation = useResolveApprovalMutation();
  const resolvePluginApprovalMutation = useResolvePluginApprovalMutation();
  const updatePolicyMutation = useUpdateApprovalsPolicyMutation();
  const [pendingOverlay, setPendingOverlay] = useState<DeckGoPendingApprovalsResponse | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [selectedPluginApprovalId, setSelectedPluginApprovalId] = useState("");
  const [surface, setSurface] = useState<ApprovalSurface>("exec");
  const [kindFilter, setKindFilter] = useState<ApprovalKindFilter>("all");
  const [query, setQuery] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [actionState, setActionState] = useState<ApprovalDecision | "idle">("idle");
  const [policySaveState, setPolicySaveState] = useState<"idle" | "saving">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [recentDecisionEvidence, setRecentDecisionEvidence] = useState<DecisionEvidence[]>([]);
  const [policyDraft, setPolicyDraft] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [newAllowlistPath, setNewAllowlistPath] = useState("");
  const [actionError, setActionError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (pendingQuery.data) {
      setPendingOverlay(pendingQuery.data);
    }
  }, [pendingQuery.data]);

  const policyResponse = policyQuery.data ?? null;
  const pendingResponse = pendingOverlay ?? pendingQuery.data ?? null;
  const pluginResponse = pluginQuery.data ?? null;
  const queryError = policyQuery.error ?? pendingQuery.error ?? pluginQuery.error;
  const error =
    actionError ||
    (queryError instanceof Error ? queryError.message : queryError ? t("loadFailed") : "");
  const loadState: PanelState =
    policyQuery.isLoading || pendingQuery.isLoading || pluginQuery.isLoading
      ? "loading"
      : policyResponse || pendingResponse || pluginResponse
        ? "ready"
        : "idle";

  const refresh = async () => {
    try {
      const [nextPolicy, nextPending, nextPlugins] = await Promise.all([
        policyQuery.refetch(),
        pendingQuery.refetch(),
        pluginQuery.refetch(),
      ]);
      const failedResult = [nextPolicy, nextPending, nextPlugins].find((result) => result.error);
      if (failedResult?.error) {
        throw failedResult.error;
      }
      setPendingOverlay(nextPending.data ?? null);
      setActionError("");
    } catch (loadError) {
      setActionError(loadError instanceof Error ? loadError.message : t("loadFailed"));
    }
  };

  useEffect(() => {
    const nextPolicyDraft = normalizePolicy(policyResponse);
    const formatted = formatPolicyDraft(
      nextPolicyDraft ?? { defaults: {}, agents: {}, allowlist: [] },
    );
    setPolicyDraft((current) => (policyOpen && current.trim() ? current : formatted));
  }, [policyOpen, policyResponse]);

  useApprovalsStream({ setPendingResponse: setPendingOverlay, setSelectedApprovalId });

  const policy = useMemo(() => normalizePolicy(policyResponse), [policyResponse]);
  const pendingApprovals = useMemo(
    () => filterActivePendingApprovals(pendingResponse?.pending ?? [], nowMs),
    [pendingResponse, nowMs],
  );
  const pluginApprovals = useMemo(() => normalizePluginApprovals(pluginResponse), [pluginResponse]);
  const activePluginApprovals = useMemo(
    () =>
      pluginApprovals.filter(
        (approval) => !approval.decision && !isPluginApprovalExpired(approval, nowMs),
      ),
    [pluginApprovals, nowMs],
  );

  const allQueueEntries = useMemo<QueueEntry[]>(() => {
    const execEntries: QueueEntry[] = pendingApprovals.map((approval) => ({
      kind: "exec",
      id: approval.id,
      title: approval.command,
      subtitle: approval.agentId || approval.cwd || approval.sessionKey || t("notAvailable"),
      createdAtMs: approval.createdAtMs,
      expiresAtMs: approval.expiresAtMs,
      searchText: normalizeSearchText([
        approval.id,
        approval.command,
        approval.agentId,
        approval.sessionKey,
        approval.runId,
        approval.cwd,
      ]),
      payload: approval,
    }));
    const pluginEntries: QueueEntry[] = activePluginApprovals.map((approval) => ({
      kind: "plugins",
      id: approval.id,
      title: approval.command || approval.pluginId || approval.id,
      subtitle: approval.description || approval.pluginId || approval.status || t("notAvailable"),
      createdAtMs: approval.createdAtMs,
      expiresAtMs: approval.expiresAtMs,
      searchText: normalizeSearchText([
        approval.id,
        approval.pluginId,
        approval.command,
        approval.description,
        approval.status,
        approval.decision,
      ]),
      payload: approval,
    }));
    return [...execEntries, ...pluginEntries].toSorted(
      (a, b) =>
        (a.expiresAtMs ?? Number.MAX_SAFE_INTEGER) - (b.expiresAtMs ?? Number.MAX_SAFE_INTEGER),
    );
  }, [activePluginApprovals, pendingApprovals, t]);

  const queueEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allQueueEntries.filter((entry) => {
      if (kindFilter !== "all" && entry.kind !== kindFilter) {
        return false;
      }
      return !normalizedQuery || entry.searchText.includes(normalizedQuery);
    });
  }, [allQueueEntries, kindFilter, query]);

  useEffect(() => {
    if (queueEntries.length === 0) {
      return;
    }
    const currentKey =
      surface === "exec" ? `exec:${selectedApprovalId}` : `plugins:${selectedPluginApprovalId}`;
    if (queueEntries.some((entry) => `${entry.kind}:${entry.id}` === currentKey)) {
      return;
    }
    const next = queueEntries[0];
    setSurface(next.kind);
    setDetailTab("overview");
    if (next.kind === "exec") {
      setSelectedApprovalId(next.id);
    } else {
      setSelectedPluginApprovalId(next.id);
    }
  }, [queueEntries, selectedApprovalId, selectedPluginApprovalId, surface]);

  const selectedApproval =
    pendingApprovals.find((approval) => approval.id === selectedApprovalId) ??
    pendingApprovals[0] ??
    null;
  const selectedPluginApproval =
    activePluginApprovals.find((approval) => approval.id === selectedPluginApprovalId) ??
    activePluginApprovals[0] ??
    null;

  const selectedEntry: QueueEntry | null =
    surface === "exec" && selectedApproval
      ? {
          kind: "exec",
          id: selectedApproval.id,
          title: selectedApproval.command,
          subtitle:
            selectedApproval.agentId ||
            selectedApproval.cwd ||
            selectedApproval.sessionKey ||
            t("notAvailable"),
          createdAtMs: selectedApproval.createdAtMs,
          expiresAtMs: selectedApproval.expiresAtMs,
          searchText: "",
          payload: selectedApproval,
        }
      : surface === "plugins" && selectedPluginApproval
        ? {
            kind: "plugins",
            id: selectedPluginApproval.id,
            title:
              selectedPluginApproval.command ||
              selectedPluginApproval.pluginId ||
              selectedPluginApproval.id,
            subtitle:
              selectedPluginApproval.description ||
              selectedPluginApproval.pluginId ||
              selectedPluginApproval.status ||
              t("notAvailable"),
            createdAtMs: selectedPluginApproval.createdAtMs,
            expiresAtMs: selectedPluginApproval.expiresAtMs,
            searchText: "",
            payload: selectedPluginApproval,
          }
        : null;

  const runDecision = async (decision: ApprovalDecision) => {
    if (!selectedApproval) {
      return;
    }
    setActionState(decision);
    try {
      const result = await resolveApprovalMutation.mutateAsync({
        decision,
        id: selectedApproval.id,
      });
      setActionResult(result);
      const evidence: DecisionEvidence = {
        id: selectedApproval.id,
        kind: "exec",
        title: selectedApproval.command,
        decision,
        actor: selectedApproval.agentId || t("operator"),
        decidedAtMs: Date.now(),
      };
      setRecentDecisionEvidence((current) => [evidence, ...current].slice(0, 12));
      setActionError("");
      await refresh();
    } catch (actionError) {
      setActionError(
        actionError instanceof Error ? actionError.message : t("approvalActionFailed"),
      );
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
      const result = await resolvePluginApprovalMutation.mutateAsync({
        decision,
        id: selectedPluginApproval.id,
      });
      setActionResult(result);
      const evidence: DecisionEvidence = {
        id: selectedPluginApproval.id,
        kind: "plugin",
        title:
          selectedPluginApproval.command ||
          selectedPluginApproval.pluginId ||
          selectedPluginApproval.id,
        decision,
        actor: selectedPluginApproval.pluginId || t("operator"),
        decidedAtMs: Date.now(),
      };
      setRecentDecisionEvidence((current) => [evidence, ...current].slice(0, 12));
      setActionError("");
      await refresh();
    } catch (actionError) {
      setActionError(actionError instanceof Error ? actionError.message : t("pluginResolveFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const runSelectedDecision = async (decision: ApprovalDecision) => {
    if (surface === "exec") {
      await runDecision(decision);
      return;
    }
    await runPluginDecision(decision);
  };

  const savePolicyDraft = async () => {
    setPolicySaveState("saving");
    try {
      const normalized = parsePolicyDraft(policyDraft);
      if (!normalized) {
        throw new Error(t("policyJsonInvalidShort"));
      }
      const result = await updatePolicyMutation.mutateAsync({
        baseHash: policyResponse?.hash,
        file: normalized,
      });
      setActionResult(result);
      setActionError("");
      await refresh();
      setPolicyOpen(false);
    } catch (policyError) {
      setActionError(policyError instanceof Error ? policyError.message : t("policySaveFailed"));
    } finally {
      setPolicySaveState("idle");
    }
  };

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

  const selectEntry = (entry: QueueEntry) => {
    setSurface(entry.kind);
    setDetailTab("overview");
    if (entry.kind === "exec") {
      setSelectedApprovalId(entry.id);
    } else {
      setSelectedPluginApprovalId(entry.id);
    }
  };

  const decisionDisabled =
    actionState !== "idle" ||
    (surface === "exec" && !selectedApproval) ||
    (surface === "plugins" && !selectedPluginApproval);

  const detailTabs: DetailTab[] =
    surface === "exec"
      ? ["overview", "argv", "plan", "activity"]
      : ["overview", "scopes", "source", "activity"];

  return (
    <section className="approvals-panel" data-testid="approvals-panel">
      <header className="approvals-panel__topbar">
        <div className="approvals-panel__title-stack">
          <p className="approvals-panel__eyebrow">{t("securityOps")}</p>
          <h1 className="approvals-panel__title">{t("title")}</h1>
          <p className="approvals-panel__description">
            {t("panelDescription")} {t("policyHash")}: {policyResponse?.hash || t("notAvailable")}
          </p>
        </div>
        <div className="approvals-panel__topbar-actions">
          <button className="approvals-panel__button" type="button" onClick={() => void refresh()}>
            {t("refreshApprovals")}
          </button>
          <button
            className="approvals-panel__button is-primary"
            type="button"
            onClick={() => setPolicyOpen(true)}
          >
            {t("approvalPolicyEditor")}
          </button>
        </div>
      </header>

      <div className="approvals-panel__kpis">
        <ApprovalMetric label={t("loadState")} value={`${t("approvalsLabel")} ${loadState}`} />
        <ApprovalMetric label={t("pendingExec")} value={pendingApprovals.length} />
        <ApprovalMetric label={t("pendingPlugin")} value={activePluginApprovals.length} />
        <ApprovalMetric label={t("allowlist")} value={policy?.allowlist.length ?? 0} />
        <ApprovalMetric
          label={t("agentOverrides")}
          value={Object.keys(policy?.agents ?? {}).length}
        />
      </div>

      <div className="approvals-panel__workspace">
        <article className="approvals-panel__card approvals-panel__queue">
          <div className="approvals-panel__card-head">
            <div>
              <p className="approvals-panel__eyebrow">{t("pending")}</p>
              <h2 className="approvals-panel__title is-compact">{t("decisionInbox")}</h2>
            </div>
            <span className={`approvals-panel__pill ${loadState === "ready" ? "is-good" : ""}`}>
              {queueEntries.length} {t("visible")}
            </span>
          </div>
          <div className="approvals-panel__body">
            <div
              className="approvals-panel__filters"
              role="tablist"
              aria-label={t("approvalKindFilter")}
            >
              {(["all", "exec", "plugins"] as ApprovalKindFilter[]).map((filter) => (
                <button
                  key={filter}
                  className={`approvals-panel__button ${kindFilter === filter ? "is-primary" : ""}`}
                  role="tab"
                  aria-selected={kindFilter === filter}
                  type="button"
                  onClick={() => setKindFilter(filter)}
                >
                  {filter === "all"
                    ? `${t("allApprovals")} ${allQueueEntries.length}`
                    : filter === "exec"
                      ? `${t("execApprovals")} ${pendingApprovals.length}`
                      : `${t("pluginApprovals")} ${activePluginApprovals.length}`}
                </button>
              ))}
            </div>
            <label className="approvals-panel__field">
              <span>{t("search")}</span>
              <input
                aria-label="search approvals"
                className="approvals-panel__input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </label>
            {error ? <p className="approvals-panel__note is-danger">{error}</p> : null}
            {queueEntries.length > 0 ? (
              <ul className="approvals-panel__list" role="list" aria-label={t("pendingApprovals")}>
                {queueEntries.map((entry) => {
                  const selected =
                    surface === entry.kind &&
                    (entry.kind === "exec"
                      ? selectedApprovalId === entry.id
                      : selectedPluginApprovalId === entry.id);
                  return (
                    <li key={`${entry.kind}:${entry.id}`} role="listitem">
                      <button
                        type="button"
                        className={`approvals-panel__row is-${entry.kind} ${selected ? "is-selected" : ""}`}
                        onClick={() => selectEntry(entry)}
                      >
                        <div className="approvals-panel__row-main">
                          <div className="approvals-panel__row-head">
                            <span
                              className={`approvals-panel__pill ${
                                entry.kind === "exec" ? "is-warn" : "is-good"
                              }`}
                            >
                              {entry.kind === "exec" ? t("exec") : t("plugin")}
                            </span>
                            <span className="approvals-panel__pill">
                              {formatRemaining(entry.expiresAtMs, nowMs, t("notAvailable"))}
                            </span>
                          </div>
                          <strong>{entry.title}</strong>
                          <p className="approvals-panel__meta">
                            {entry.subtitle} | {entry.id} |{" "}
                            {formatRelativeAge(entry.createdAtMs, nowMs, t("notAvailable"))}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="approvals-panel__note">{t("noPendingMatch")}</p>
            )}
          </div>
        </article>

        <article className="approvals-panel__card approvals-panel__detail">
          <div className="approvals-panel__card-head">
            <div>
              <p className="approvals-panel__eyebrow">{t("selectedApproval")}</p>
              <h2 className="approvals-panel__title is-compact">
                {selectedEntry?.title ?? t("selectedApproval")}
              </h2>
            </div>
            {selectedEntry ? (
              <span
                className={`approvals-panel__pill ${
                  selectedEntry.kind === "exec" ? "is-warn" : "is-good"
                }`}
              >
                {selectedEntry.kind === "exec" ? t("exec") : t("plugin")}
              </span>
            ) : null}
          </div>
          <div className="approvals-panel__body approvals-panel__detail-stack">
            {selectedEntry ? (
              <>
                <div className="approvals-panel__hero">
                  <div>
                    <p className="approvals-panel__eyebrow">
                      {selectedEntry.kind === "exec" ? t("command") : t("pluginApproval")}
                    </p>
                    <strong>{selectedEntry.title}</strong>
                    <p className="approvals-panel__note">
                      {t("id")}: {selectedEntry.id}
                    </p>
                  </div>
                  <div className="approvals-panel__pill-row">
                    <span className="approvals-panel__pill">
                      {t("created")}:{" "}
                      {formatOptionalDate(selectedEntry.createdAtMs, t("notAvailable"))}
                    </span>
                    <span className="approvals-panel__pill">
                      {t("expires")}:{" "}
                      {formatRemaining(selectedEntry.expiresAtMs, nowMs, t("notAvailable"))}
                    </span>
                  </div>
                </div>

                <div
                  className="approvals-panel__tabs"
                  role="tablist"
                  aria-label={t("approvalDetailTabs")}
                >
                  {detailTabs.map((tab) => (
                    <button
                      key={tab}
                      className={`approvals-panel__button ${detailTab === tab ? "is-primary" : ""}`}
                      role="tab"
                      aria-selected={detailTab === tab}
                      type="button"
                      onClick={() => setDetailTab(tab)}
                    >
                      {t(`tab${tab[0].toUpperCase()}${tab.slice(1)}`)}
                    </button>
                  ))}
                </div>

                {detailTab === "overview" ? (
                  <div className="approvals-panel__metrics">
                    <ApprovalMetric
                      label={t("agent")}
                      value={
                        selectedEntry.kind === "exec"
                          ? selectedEntry.payload.agentId || t("notAvailable")
                          : selectedEntry.payload.pluginId || t("notAvailable")
                      }
                    />
                    <ApprovalMetric
                      label={t("session")}
                      value={
                        selectedEntry.kind === "exec"
                          ? selectedEntry.payload.sessionKey || t("notAvailable")
                          : selectedEntry.payload.status || t("pendingBadge")
                      }
                    />
                    <ApprovalMetric
                      label={t("run")}
                      value={
                        selectedEntry.kind === "exec"
                          ? selectedEntry.payload.runId || t("notAvailable")
                          : selectedEntry.payload.decision || t("pendingBadge")
                      }
                    />
                    <ApprovalMetric
                      label={t("requestedAt")}
                      value={formatRelativeAge(selectedEntry.createdAtMs, nowMs, t("notAvailable"))}
                    />
                  </div>
                ) : null}

                {detailTab === "argv" && selectedEntry.kind === "exec" ? (
                  <div className="approvals-panel__surface">
                    <JsonDetails
                      title={t("approvalArgv")}
                      payload={{
                        cwd: selectedEntry.payload.cwd ?? null,
                        commandArgv: selectedEntry.payload.commandArgv ?? [],
                      }}
                    />
                  </div>
                ) : null}

                {detailTab === "plan" && selectedEntry.kind === "exec" ? (
                  <div className="approvals-panel__surface">
                    <p className="approvals-panel__eyebrow">{t("tabPlan")}</p>
                    <p className="approvals-panel__note">{t("planUnsupported")}</p>
                    <JsonDetails
                      title={t("decisionScope")}
                      payload={{
                        command: selectedEntry.payload.command,
                        commandArgv: selectedEntry.payload.commandArgv ?? [],
                        cwd: selectedEntry.payload.cwd ?? null,
                        agentId: selectedEntry.payload.agentId ?? null,
                        sessionKey: selectedEntry.payload.sessionKey ?? null,
                        runId: selectedEntry.payload.runId ?? null,
                      }}
                    />
                  </div>
                ) : null}

                {detailTab === "scopes" && selectedEntry.kind === "plugins" ? (
                  <div className="approvals-panel__surface">
                    <p className="approvals-panel__eyebrow">{t("tabScopes")}</p>
                    <p className="approvals-panel__note">{t("pluginScopesUnsupported")}</p>
                    <JsonDetails
                      title={t("decisionScope")}
                      payload={{
                        pluginId: selectedEntry.payload.pluginId ?? null,
                        command: selectedEntry.payload.command ?? null,
                        status: selectedEntry.payload.status ?? null,
                      }}
                    />
                  </div>
                ) : null}

                {detailTab === "source" && selectedEntry.kind === "plugins" ? (
                  <div className="approvals-panel__surface">
                    <JsonDetails
                      title={t("pluginApprovalSource")}
                      payload={{
                        pluginId: selectedEntry.payload.pluginId ?? null,
                        command: selectedEntry.payload.command ?? null,
                        description: selectedEntry.payload.description ?? null,
                        status: selectedEntry.payload.status ?? null,
                        decision: selectedEntry.payload.decision ?? null,
                      }}
                    />
                  </div>
                ) : null}

                {detailTab === "activity" ? (
                  <div className="approvals-panel__surface">
                    <p className="approvals-panel__eyebrow">{t("activity")}</p>
                    <p className="approvals-panel__note">{t("recentDecisionsUnsupported")}</p>
                  </div>
                ) : null}

                {selectedEntry.kind === "exec" ? (
                  <div className="approvals-panel__actions">
                    {selectedEntry.payload.agentId ? (
                      <button
                        className="approvals-panel__button"
                        type="button"
                        onClick={() => navigateToAgent(ui, selectedEntry.payload.agentId ?? "")}
                      >
                        {t("openApprovalAgent")}
                      </button>
                    ) : null}
                    {selectedEntry.payload.sessionKey ? (
                      <button
                        className="approvals-panel__button"
                        type="button"
                        onClick={() =>
                          navigateToSession(ui, selectedEntry.payload.sessionKey ?? "")
                        }
                      >
                        {t("openApprovalSession")}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="approvals-panel__surface approvals-panel__decision-bar">
                  <label className="approvals-panel__field">
                    <span>{t("decisionReason")}</span>
                    <input
                      aria-label="approval decision reason unsupported"
                      className="approvals-panel__input"
                      disabled
                      value=""
                      placeholder={t("decisionReasonUnsupported")}
                      readOnly
                    />
                  </label>
                  <div className="approvals-panel__actions">
                    {(["deny", "allow-once", "allow-always"] as ApprovalDecision[]).map(
                      (decision) => (
                        <button
                          key={decision}
                          className={`approvals-panel__button ${
                            decision === "deny"
                              ? "is-danger"
                              : decision === "allow-always"
                                ? "is-primary"
                                : ""
                          }`}
                          type="button"
                          onClick={() => void runSelectedDecision(decision)}
                          disabled={decisionDisabled}
                        >
                          {actionState === decision
                            ? t("submittingDecision")
                            : decisionLabel(t, decision)}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="approvals-panel__surface">
                  <JsonDetails
                    title={
                      selectedEntry.kind === "exec"
                        ? t("approvalPayload")
                        : t("pluginApprovalPayload")
                    }
                    payload={selectedEntry.payload}
                  />
                </div>
              </>
            ) : (
              <p className="approvals-panel__note">{t("choosePendingApproval")}</p>
            )}

            {policy ? (
              <div className="approvals-panel__surface">
                <JsonDetails title={t("policyPayload")} payload={policy} />
              </div>
            ) : null}
            {actionResult ? (
              <div className="approvals-panel__surface">
                <JsonDetails title={t("lastApprovalAction")} payload={actionResult} />
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <footer className="approvals-panel__card approvals-panel__recent">
        <div className="approvals-panel__card-head">
          <div>
            <p className="approvals-panel__eyebrow">{t("activity")}</p>
            <h2 className="approvals-panel__title is-compact">{t("recentDecisions")}</h2>
          </div>
          <span className="approvals-panel__pill">
            {recentDecisionEvidence.length} {t("visible")}
          </span>
        </div>
        <div className="approvals-panel__body">
          {recentDecisionEvidence.length > 0 ? (
            <ul className="approvals-panel__recent-list" role="list">
              {recentDecisionEvidence.map((entry) => (
                <li
                  key={`${entry.id}:${entry.decidedAtMs}`}
                  className="approvals-panel__recent-row"
                >
                  <span
                    className={`approvals-panel__pill ${
                      entry.decision === "deny"
                        ? "is-danger"
                        : entry.decision === "allow-always"
                          ? "is-good"
                          : ""
                    }`}
                  >
                    {recordDecisionLabel(t, entry.decision)}
                  </span>
                  <span
                    className={`approvals-panel__pill ${
                      entry.kind === "exec" ? "is-warn" : "is-good"
                    }`}
                  >
                    {entry.kind === "exec" ? t("exec") : t("plugin")}
                  </span>
                  <strong>{entry.title}</strong>
                  <span className="approvals-panel__meta">{entry.actor}</span>
                  <span className="approvals-panel__meta">
                    {formatRelativeAge(entry.decidedAtMs, nowMs, t("notAvailable"))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="approvals-panel__note">{t("recentDecisionsEmpty")}</p>
          )}
          <p className="approvals-panel__note">{t("recentDecisionsUnsupported")}</p>
        </div>
      </footer>

      {policyOpen ? (
        <div className="approvals-panel__modal-backdrop" role="presentation">
          <div
            className="approvals-panel__modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("approvalPolicyEditor")}
          >
            <div className="approvals-panel__card-head">
              <div>
                <p className="approvals-panel__eyebrow">{t("policy")}</p>
                <h2 className="approvals-panel__title is-compact">{t("approvalPolicyEditor")}</h2>
              </div>
              <button
                aria-label={t("closePolicyEditor")}
                className="approvals-panel__button"
                type="button"
                onClick={() => setPolicyOpen(false)}
                disabled={policySaveState !== "idle"}
              >
                {t("close")}
              </button>
            </div>
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
