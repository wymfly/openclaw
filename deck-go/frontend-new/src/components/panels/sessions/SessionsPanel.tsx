import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoSubagentsLineageResponse } from "@/api-types";
import {
  buildSessionExportJson,
  buildSessionExportMarkdown,
  findTranscriptMatches,
  transcriptMessageToPlainText,
} from "@/lib/session-export";
import { normalizeTranscriptMessages } from "@/lib/transcript-adapter";
import {
  getCachedTranscript,
  invalidateTranscript,
  setCachedTranscript,
} from "@/lib/transcript-cache";
import type {
  DeckGoChatHistoryResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionMeta,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
} from "../../../../../contracts/generated/ts/deck-api.generated";
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import {
  sessionDetailQueryOptions,
  sessionHistoryQueryOptions,
  sessionLineageQueryOptions,
  sessionPreviewsQueryOptions,
  sessionsListQueryOptions,
  useClearSessionMutation,
  useCompactSessionMutation,
  useDeleteSessionMutation,
  usePatchSessionMutation,
  useResetSessionMutation,
} from "../../../data/modules/sessions";
import { navigateToPanel } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  Badge,
  Button,
  Card,
  Code,
  Input,
  SegmentedControl,
  Select,
  Toggle,
} from "../../../design-system/atoms";
import type { BadgeVariant } from "../../../design-system/atoms";
import { useTranslations } from "../../../i18n/provider";
import { SessionCompactionHistory } from "./SessionCompactionHistory";
import { SessionSubagentDetails, type SessionRelationshipMeta } from "./SessionSubagentDetails";
import { SessionUsageDetails } from "./SessionUsageDetails";
import "./sessions-panel.css";

type PanelState = "idle" | "loading" | "ready";

type RefreshSessionsOptions = {
  preferredSessionKey?: string;
  preserveSelection?: boolean;
  currentSessionKey?: string;
};

type NormalizedHistoryMessages = ReturnType<typeof normalizeTranscriptMessages>;
type SessionKindFilter = "" | "direct" | "group" | "global" | "subagent";
type SessionInspectorTab = "overview" | "usage" | "compaction" | "lineage" | "actions";
type SessionPreview = NonNullable<DeckGoSessionsPreviewResponse["previews"]>[number];

const PREVIEW_LIMIT = 12;
const SESSION_FETCH_LIMIT = 200;
const SESSION_PAGE_SIZE = 20;
const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
const INSPECTOR_TABS: readonly SessionInspectorTab[] = [
  "overview",
  "usage",
  "compaction",
  "lineage",
  "actions",
];

function readSessionNavigationTarget() {
  if (typeof window === "undefined") {
    return { sessionKey: "" };
  }
  return {
    sessionKey: new URL(window.location.href).searchParams.get("sessionKey")?.trim() ?? "",
  };
}

function positiveNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function formatCompactNumber(value: number | null) {
  if (value == null) {
    return "n/a";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

function formatCost(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `$${value.toFixed(4)}`
    : "n/a";
}

function formatTimestamp(value?: number) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function sessionTotalTokens(session: DeckGoSessionMeta | null) {
  if (!session) {
    return null;
  }
  const explicitTotal = positiveNumber(session.totalTokens);
  if (explicitTotal != null) {
    return explicitTotal;
  }
  const input = positiveNumber(session.inputTokens) ?? 0;
  const output = positiveNumber(session.outputTokens) ?? 0;
  const total = input + output;
  return total > 0 ? total : null;
}

function sessionContextPressure(session: DeckGoSessionMeta | null) {
  const used = sessionTotalTokens(session);
  const contextWindow = positiveNumber(session?.contextTokens);
  if (used == null || contextWindow == null) {
    return null;
  }
  return Math.min(100, Math.round((used / contextWindow) * 100));
}

function normalizeThinkingLevel(value: string | undefined): string {
  if (THINKING_LEVELS.includes(value as (typeof THINKING_LEVELS)[number])) {
    return value ?? "off";
  }
  return "off";
}

function firstSessionKey(payload: DeckGoSessionsListResponse | null) {
  return payload?.sessions?.[0]?.key ?? "";
}

function historyResponseFromMessages(
  messages: NormalizedHistoryMessages,
): DeckGoChatHistoryResponse {
  return { messages: messages as DeckGoChatHistoryResponse["messages"] };
}

function inferSessionKind(session: DeckGoSessionMeta): SessionKindFilter | "unknown" {
  const declaredKind = (session as DeckGoSessionMeta & { kind?: string }).kind;
  if (
    declaredKind === "direct" ||
    declaredKind === "group" ||
    declaredKind === "global" ||
    declaredKind === "subagent"
  ) {
    return declaredKind;
  }
  const key = session.key.toLowerCase();
  if (key.includes(":subagent:")) {
    return "subagent";
  }
  if (key.startsWith("direct:") || key.includes(":direct:")) {
    return "direct";
  }
  if (key.startsWith("group:") || key.includes(":group:")) {
    return "group";
  }
  if (key.startsWith("global:") || key.includes(":global:")) {
    return "global";
  }
  return "unknown";
}

function isSubagentSession(session: DeckGoSessionMeta | null, sessionKey: string) {
  if (session && inferSessionKind(session) === "subagent") {
    return true;
  }
  return sessionKey.toLowerCase().includes(":subagent:");
}

function statusVariant(status: string | undefined): BadgeVariant {
  switch ((status ?? "").toLowerCase()) {
    case "idle":
    case "completed":
    case "ok":
    case "ready":
      return "ok";
    case "running":
    case "active":
    case "loading":
      return "running";
    case "failed":
    case "error":
    case "timeout":
      return "err";
    case "warn":
    case "warning":
    case "busy":
      return "warn";
    default:
      return "neutral";
  }
}

function previewText(preview: SessionPreview | undefined, session: DeckGoSessionMeta) {
  const previewItems = preview?.items ?? [];
  const text = previewItems
    .map((item) => item.text)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 2)
    .join(" / ");
  return text || session.lastMessagePreview || "n/a";
}

function MetricTile(props: { hint?: string; label: string; value: string | number }) {
  return (
    <article className="sessions-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
}

function StatTile(props: { label: string; value: string | number }) {
  return (
    <div className="sessions-stat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function SessionsPanel() {
  const t = useTranslations("sessions");
  const ui = useDeckUI();
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const patchSessionMutation = usePatchSessionMutation();
  const resetSessionMutation = useResetSessionMutation();
  const clearSessionMutation = useClearSessionMutation();
  const compactSessionMutation = useCompactSessionMutation();
  const deleteSessionMutation = useDeleteSessionMutation();
  const [navigationTarget] = useState(readSessionNavigationTarget);
  const [sessions, setSessions] = useState<DeckGoSessionsListResponse | null>(null);
  const [previews, setPreviews] = useState<DeckGoSessionsPreviewResponse | null>(null);
  const [detail, setDetail] = useState<DeckGoSessionDetailResponse | null>(null);
  const [history, setHistory] = useState<DeckGoChatHistoryResponse | null>(null);
  const [lineage, setLineage] = useState<DeckGoSubagentsLineageResponse | null>(null);
  const [inventoryState, setInventoryState] = useState<PanelState>("idle");
  const [detailState, setDetailState] = useState<PanelState>("idle");
  const [lineageState, setLineageState] = useState<PanelState>("idle");
  const [selectedSessionKey, setSelectedSessionKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionKindFilter, setSessionKindFilter] = useState<SessionKindFilter>("");
  const [activeMinutesFilter, setActiveMinutesFilter] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState("");
  const [currentTranscriptMatch, setCurrentTranscriptMatch] = useState(0);
  const [modelOverride, setModelOverride] = useState("cpa/gpt-5.4");
  const [labelOverride, setLabelOverride] = useState("");
  const [thinkingOverride, setThinkingOverride] = useState("off");
  const [fastModeOverride, setFastModeOverride] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<SessionInspectorTab>("overview");
  const [resetConfirming, setResetConfirming] = useState(false);
  const [clearConfirming, setClearConfirming] = useState(false);
  const [compactConfirming, setCompactConfirming] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [exportPreview, setExportPreview] = useState<{
    format: "json" | "markdown";
    text: string;
  } | null>(null);

  const refreshSessionsInventory = useCallback(
    async (options?: RefreshSessionsOptions) => {
      setInventoryState("loading");
      try {
        const filters = {
          ...(activeMinutesFilter ? { activeMinutes: Number(activeMinutesFilter) } : {}),
          limit: SESSION_FETCH_LIMIT,
          ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        };
        const sessionsResult = await queryClient.fetchQuery({
          ...sessionsListQueryOptions(bff, filters),
          staleTime: 0,
        });
        const previewKeys = (sessionsResult.sessions ?? [])
          .slice(0, PREVIEW_LIMIT)
          .map((session) => session.key);
        const previewResult =
          previewKeys.length > 0
            ? await queryClient.fetchQuery({
                ...sessionPreviewsQueryOptions(bff, previewKeys),
                staleTime: 0,
              })
            : { previews: [] };
        setSessions(sessionsResult);
        setPreviews(previewResult);
        setInventoryState("ready");
        setError("");

        const preferred = options?.preferredSessionKey?.trim() || "";
        const current = options?.preserveSelection ? options.currentSessionKey?.trim() || "" : "";
        const sessionExists = (sessionsResult.sessions ?? []).some(
          (session) => session.key === preferred,
        );
        const next =
          preferred && sessionExists
            ? preferred
            : preferred && options?.preferredSessionKey
              ? preferred
              : current &&
                  (sessionsResult.sessions ?? []).some((session) => session.key === current)
                ? current
                : firstSessionKey(sessionsResult);

        setSelectedSessionKey(next);
      } catch (loadError) {
        setInventoryState("idle");
        setError(loadError instanceof Error ? loadError.message : t("failedLoadSessions"));
      }
    },
    [activeMinutesFilter, bff, queryClient, searchQuery, t],
  );

  const refreshSelectedSession = useCallback(
    async (sessionKey: string) => {
      const trimmed = sessionKey.trim();
      if (!trimmed) {
        setDetail(null);
        setHistory(null);
        setDetailState("idle");
        return;
      }
      setDetailState("loading");
      try {
        const cachedHistory = getCachedTranscript(trimmed);
        const historyPromise = cachedHistory
          ? Promise.resolve(historyResponseFromMessages(cachedHistory))
          : queryClient
              .fetchQuery(sessionHistoryQueryOptions(bff, trimmed, 80))
              .then((historyResult) => {
                const normalizedMessages = normalizeTranscriptMessages(
                  trimmed,
                  historyResult.messages as unknown as Array<Record<string, unknown>>,
                );
                setCachedTranscript(trimmed, normalizedMessages);
                return historyResponseFromMessages(normalizedMessages);
              });
        const [detailResult, historyResult] = await Promise.all([
          queryClient.fetchQuery(sessionDetailQueryOptions(bff, { sessionKey: trimmed })),
          historyPromise,
        ]);
        setDetail(detailResult);
        setHistory(historyResult);
        setDetailState("ready");
        setLineage(null);
        setLineageState("idle");
        if (isSubagentSession(detailResult.session ?? null, trimmed)) {
          setLineageState("loading");
          try {
            const lineageResult = await queryClient.fetchQuery(
              sessionLineageQueryOptions(bff, trimmed),
            );
            setLineage(lineageResult);
            setLineageState("ready");
          } catch (lineageError) {
            setLineageState("idle");
            setError(lineageError instanceof Error ? lineageError.message : t("failedLoadLineage"));
            return;
          }
        }
        setError("");
      } catch (detailError) {
        setDetailState("idle");
        setLineage(null);
        setLineageState("idle");
        setError(detailError instanceof Error ? detailError.message : t("failedLoadSessionDetail"));
      }
    },
    [bff, queryClient, t],
  );

  useEffect(() => {
    void refreshSessionsInventory({ preferredSessionKey: navigationTarget.sessionKey });
  }, [navigationTarget.sessionKey, refreshSessionsInventory]);

  useEffect(() => {
    void refreshSelectedSession(selectedSessionKey);
  }, [refreshSelectedSession, selectedSessionKey]);

  const filteredSessions = useMemo(() => {
    const sessionList = sessions?.sessions ?? [];
    const query = searchQuery.trim().toLowerCase();
    return sessionList.filter((session) => {
      if (sessionKindFilter && inferSessionKind(session) !== sessionKindFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const title = (session.title || session.key).toLowerCase();
      const preview = (session.lastMessagePreview || "").toLowerCase();
      return (
        title.includes(query) ||
        preview.includes(query) ||
        session.key.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, sessionKindFilter, sessions]);
  const totalSessionPages = Math.max(1, Math.ceil(filteredSessions.length / SESSION_PAGE_SIZE));
  const pagedSessions = useMemo(
    () =>
      filteredSessions.slice(
        (sessionPage - 1) * SESSION_PAGE_SIZE,
        sessionPage * SESSION_PAGE_SIZE,
      ),
    [filteredSessions, sessionPage],
  );

  useEffect(() => {
    setSessionPage(1);
  }, [activeMinutesFilter, searchQuery, sessionKindFilter]);

  const selectedSession =
    filteredSessions.find((session) => session.key === selectedSessionKey) ??
    sessions?.sessions?.find((session) => session.key === selectedSessionKey) ??
    detail?.session ??
    null;
  const selectedTotalTokens = sessionTotalTokens(selectedSession);
  const selectedContextTokens = positiveNumber(selectedSession?.contextTokens);
  const selectedContextPressure = sessionContextPressure(selectedSession);
  const selectedSessionRelationships = selectedSession as SessionRelationshipMeta | null;
  const selectedIsSubagent = isSubagentSession(selectedSession, selectedSessionKey);
  const parentSessionKey = selectedSessionRelationships?.parentSessionKey ?? "";
  const childSessionKeys = selectedSessionRelationships?.childSessions ?? [];
  const lineageLinkCount = (parentSessionKey ? 1 : 0) + childSessionKeys.length;
  const selectedLineageValue = selectedIsSubagent
    ? t("subagentValue")
    : selectedSession
      ? inferSessionKind(selectedSession)
      : t("na");
  const transcriptMessages = history?.messages ?? [];
  const transcriptMatchIndices = useMemo(
    () => findTranscriptMatches(transcriptMessages, transcriptSearchQuery),
    [transcriptMessages, transcriptSearchQuery],
  );
  const selectedTranscriptMatchIndex = transcriptMatchIndices[currentTranscriptMatch] ?? -1;
  const selectedTranscriptMatch =
    selectedTranscriptMatchIndex >= 0 ? transcriptMessages[selectedTranscriptMatchIndex] : null;
  const previewByKey = useMemo(() => {
    const map = new Map<string, SessionPreview>();
    for (const preview of previews?.previews ?? []) {
      map.set(preview.key, preview);
    }
    return map;
  }, [previews]);

  useEffect(() => {
    setCurrentTranscriptMatch(0);
  }, [transcriptSearchQuery, selectedSessionKey]);

  useEffect(() => {
    setResetConfirming(false);
    setClearConfirming(false);
    setCompactConfirming(false);
    setDeleteConfirming(false);
  }, [selectedSessionKey]);

  useEffect(() => {
    setLabelOverride(selectedSession?.label || selectedSession?.title || "");
    setThinkingOverride(normalizeThinkingLevel(selectedSession?.thinkingLevel));
    setFastModeOverride(selectedSession?.fastMode === true);
    setModelOverride(selectedSession?.model || "cpa/gpt-5.4");
  }, [
    selectedSession?.fastMode,
    selectedSession?.label,
    selectedSession?.model,
    selectedSession?.thinkingLevel,
    selectedSession?.title,
  ]);

  const moveTranscriptMatch = (direction: 1 | -1) => {
    if (transcriptMatchIndices.length === 0) {
      return;
    }
    setCurrentTranscriptMatch(
      (current) =>
        (current + direction + transcriptMatchIndices.length) % transcriptMatchIndices.length,
    );
  };

  const prepareExport = (format: "json" | "markdown") => {
    if (!selectedSession) {
      return;
    }
    const text =
      format === "json"
        ? buildSessionExportJson(selectedSession, transcriptMessages)
        : buildSessionExportMarkdown(selectedSession, transcriptMessages);
    setExportPreview({ format, text });
  };

  const runAction = async (
    action: () => Promise<unknown>,
    options?: { preserveSelectedSession?: boolean },
  ) => {
    const currentSessionKey = selectedSessionKey;
    const preserveSelectedSession = options?.preserveSelectedSession ?? true;
    try {
      const result = await action();
      if (currentSessionKey) {
        invalidateTranscript(currentSessionKey);
      }
      setActionResult(result);
      setExportPreview(null);
      if (preserveSelectedSession) {
        await refreshSessionsInventory({
          preferredSessionKey: currentSessionKey,
          preserveSelection: true,
          currentSessionKey,
        });
        await refreshSelectedSession(currentSessionKey);
      } else {
        setDetail(null);
        setHistory(null);
        await refreshSessionsInventory();
      }
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("sessionActionFailed"));
    }
  };

  const clearActionConfirmations = (except?: "reset" | "clear" | "compact" | "delete") => {
    if (except !== "reset") {
      setResetConfirming(false);
    }
    if (except !== "clear") {
      setClearConfirming(false);
    }
    if (except !== "compact") {
      setCompactConfirming(false);
    }
    if (except !== "delete") {
      setDeleteConfirming(false);
    }
  };

  const inspectorItems = INSPECTOR_TABS.map((tab) => ({
    value: tab,
    label: t(`inspector.${tab}`),
    controls: `sessions-inspector-${tab}`,
  }));

  const onSelectSession = (session: DeckGoSessionMeta) => {
    setSelectedSessionKey(session.key);
  };

  return (
    <section className="sessions-panel" data-testid="sessions-panel">
      <header className="sessions-panel__header">
        <div>
          <p className="sessions-eyebrow">{t("eyebrow")}</p>
          <h2>{t("pageTitle")}</h2>
          <p className="sessions-note">{t("inventoryDescription")}</p>
        </div>
        <div className="sessions-panel__header-actions">
          <Badge variant={inventoryState === "ready" ? "ok" : "neutral"}>
            {t("inventoryStatus", { state: t(inventoryState) })}
          </Badge>
          <Badge variant={detailState === "ready" ? "ok" : "neutral"}>
            {t("detailStatus", { state: t(detailState) })}
          </Badge>
          <Badge>{t("visibleCount", { count: filteredSessions.length })}</Badge>
          <Button
            size="sm"
            onClick={() =>
              void refreshSessionsInventory({
                preferredSessionKey: selectedSessionKey,
                preserveSelection: true,
                currentSessionKey: selectedSessionKey,
              })
            }
          >
            {t("refreshSessions")}
          </Button>
        </div>
      </header>

      <section className="sessions-metrics" aria-label="Sessions metrics">
        <MetricTile
          label={t("selectedMetric")}
          value={selectedSession?.title || selectedSessionKey || t("na")}
          hint={selectedSession?.key}
        />
        <MetricTile
          label={t("contextMetric")}
          value={selectedContextPressure != null ? `${selectedContextPressure}%` : t("na")}
          hint={`${formatCompactNumber(selectedTotalTokens)} / ${formatCompactNumber(selectedContextTokens)}`}
        />
        <MetricTile
          label={t("usageMetric")}
          value={formatCost(selectedSession?.estimatedCostUsd)}
          hint={t("totalTokens")}
        />
        <MetricTile
          label={t("compactions")}
          value={selectedSession?.compactionCount ?? 0}
          hint={
            (selectedSession?.compactionCount ?? 0) > 0
              ? t("checkpointAvailable")
              : t("runtimeMetadata")
          }
        />
        <MetricTile
          label={t("lineageMetric")}
          value={selectedLineageValue}
          hint={
            lineageLinkCount > 0
              ? t("relationshipLinks", { count: lineageLinkCount })
              : t("noLineageLinks")
          }
        />
      </section>

      <section className="sessions-workbench">
        <aside className="sessions-column">
          <Card className="sessions-card" padded={false}>
            <div className="sessions-card__header">
              <div>
                <h3>{t("inventoryTitle")}</h3>
                <p>{t("detailDescription")}</p>
              </div>
            </div>
            <div className="sessions-card__body">
              <label className="sessions-field">
                <span>{t("searchSessions")}</span>
                <Input
                  className="sessions-input"
                  inputSize="sm"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("searchSessionsPlaceholder")}
                />
              </label>
              <div className="sessions-controls">
                <label className="sessions-field">
                  <span>{t("sessionType")}</span>
                  <Select
                    aria-label={t("sessionTypeFilter")}
                    className="sessions-select"
                    selectSize="sm"
                    value={sessionKindFilter}
                    onChange={(event) =>
                      setSessionKindFilter(event.target.value as SessionKindFilter)
                    }
                  >
                    <option value="">{t("allTypes")}</option>
                    <option value="direct">{t("directValue")}</option>
                    <option value="group">{t("groupValue")}</option>
                    <option value="global">{t("globalValue")}</option>
                    <option value="subagent">{t("subagentValue")}</option>
                  </Select>
                </label>
                <label className="sessions-field">
                  <span>{t("activeWindow")}</span>
                  <Select
                    aria-label={t("activeMinutesFilter")}
                    className="sessions-select"
                    selectSize="sm"
                    value={activeMinutesFilter}
                    onChange={(event) => setActiveMinutesFilter(event.target.value)}
                  >
                    <option value="">{t("allTime")}</option>
                    <option value="5">{t("last5m")}</option>
                    <option value="60">{t("last1h")}</option>
                    <option value="1440">{t("last24h")}</option>
                  </Select>
                </label>
              </div>
              <div className="sessions-actions">
                <Button
                  size="sm"
                  onClick={() =>
                    void refreshSessionsInventory({
                      preferredSessionKey: selectedSessionKey,
                      preserveSelection: true,
                      currentSessionKey: selectedSessionKey,
                    })
                  }
                >
                  {t("refreshSessions")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void refreshSelectedSession(selectedSessionKey)}
                  disabled={!selectedSessionKey.trim()}
                >
                  {t("refreshDetail")}
                </Button>
              </div>
              <ul className="sessions-list sessions-inventory-list">
                {pagedSessions.length === 0 ? (
                  <li className="sessions-empty">{t("noActiveSession")}</li>
                ) : (
                  pagedSessions.map((session) => {
                    const selected = session.key === selectedSessionKey;
                    const preview = previewByKey.get(session.key);
                    return (
                      <li key={session.key}>
                        <button
                          className={`sessions-inventory-row${selected ? " is-selected" : ""}`}
                          type="button"
                          onClick={() => onSelectSession(session)}
                        >
                          <span className="sessions-row-top">
                            <strong>{session.title || session.label || session.key}</strong>
                            <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
                          </span>
                          <span className="sessions-meta">
                            {session.agentId || t("na")} | {session.modelProvider || t("na")}/
                            {session.model || t("na")} | {inferSessionKind(session)}
                          </span>
                          <span className="sessions-note">
                            {session.lastMessagePreview || "n/a"}
                          </span>
                          <span className="sessions-meta">{previewText(preview, session)}</span>
                          <span className="sessions-meta">
                            {formatTimestamp(session.updatedAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="sessions-actions sessions-pagination">
                <Button
                  size="sm"
                  disabled={sessionPage <= 1}
                  onClick={() => setSessionPage((current) => Math.max(1, current - 1))}
                >
                  {t("previousPage")}
                </Button>
                <span className="sessions-note">
                  {t("pageOf", { page: sessionPage, total: totalSessionPages })}
                </span>
                <Button
                  size="sm"
                  disabled={sessionPage >= totalSessionPages}
                  onClick={() =>
                    setSessionPage((current) => Math.min(totalSessionPages, current + 1))
                  }
                >
                  {t("nextPage")}
                </Button>
              </div>
            </div>
          </Card>
        </aside>

        <section className="sessions-column sessions-column--detail">
          <Card className="sessions-card" padded={false}>
            <div className="sessions-card__header">
              <div>
                <h3>{t("detailTitle")}</h3>
                <p>{t("detailDescription")}</p>
              </div>
              <Badge variant={detailState === "ready" ? "ok" : "neutral"}>
                {t("detailStatus", { state: t(detailState) })}
              </Badge>
            </div>
            <div className="sessions-card__body">
              <section className="sessions-surface sessions-hero">
                <div className="sessions-section-heading">
                  <div>
                    <p className="sessions-eyebrow">{t("selectedSession")}</p>
                    <h3>{selectedSession?.title || selectedSessionKey || t("noActiveSession")}</h3>
                    <p className="sessions-note">
                      {t("agentStatusLine", {
                        agent: selectedSession?.agentId || t("na"),
                        status: selectedSession?.status || t("unknown"),
                      })}
                    </p>
                  </div>
                  <div className="sessions-status-row">
                    <Badge variant={statusVariant(selectedSession?.status)}>
                      {selectedSession?.status || t("unknown")}
                    </Badge>
                    <Badge>
                      {t("runtimeValue", {
                        value:
                          selectedSession?.runtimeMs != null
                            ? t("milliseconds", { value: selectedSession.runtimeMs })
                            : t("na"),
                      })}
                    </Badge>
                    {selectedContextPressure != null ? (
                      <Badge>{t("contextPercent", { percent: selectedContextPressure })}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="sessions-stat-grid">
                  <StatTile
                    label={t("tokensIn")}
                    value={formatCompactNumber(
                      positiveNumber(selectedSession?.inputTokens ?? undefined),
                    )}
                  />
                  <StatTile
                    label={t("tokensOut")}
                    value={formatCompactNumber(
                      positiveNumber(selectedSession?.outputTokens ?? undefined),
                    )}
                  />
                  <StatTile label={t("model")} value={selectedSession?.model || t("na")} />
                  <StatTile
                    label={t("thinkingLevel")}
                    value={t("thinkingFastMode", {
                      thinking: selectedSession?.thinkingLevel || t("off"),
                      fastMode: selectedSession?.fastMode ? t("on") : t("off"),
                    })}
                  />
                </div>
              </section>

              <section className="sessions-surface">
                <div className="sessions-section-heading">
                  <h3>{t("transcriptSearchExport")}</h3>
                  <Badge>
                    {transcriptSearchQuery.trim() && transcriptMatchIndices.length > 0
                      ? t("matchOf", {
                          current: currentTranscriptMatch + 1,
                          total: transcriptMatchIndices.length,
                        })
                      : t("historyMessages", { count: transcriptMessages.length })}
                  </Badge>
                </div>
                <Input
                  className="sessions-input"
                  inputSize="sm"
                  value={transcriptSearchQuery}
                  onChange={(event) => setTranscriptSearchQuery(event.target.value)}
                  placeholder={t("searchTranscriptPlaceholder")}
                />
                <div className="sessions-actions">
                  <Button
                    size="sm"
                    onClick={() => moveTranscriptMatch(-1)}
                    disabled={transcriptMatchIndices.length === 0}
                  >
                    {t("previousMatch")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => moveTranscriptMatch(1)}
                    disabled={transcriptMatchIndices.length === 0}
                  >
                    {t("nextMatch")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => prepareExport("json")}
                    disabled={!selectedSession || transcriptMessages.length === 0}
                  >
                    {t("exportJson")}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => prepareExport("markdown")}
                    disabled={!selectedSession || transcriptMessages.length === 0}
                  >
                    {t("exportMarkdown")}
                  </Button>
                </div>
                <p className="sessions-note">
                  {transcriptSearchQuery.trim()
                    ? transcriptMatchIndices.length > 0
                      ? t("matchOf", {
                          current: currentTranscriptMatch + 1,
                          total: transcriptMatchIndices.length,
                        })
                      : t("noTranscriptMatches")
                    : t("searchPrompt")}
                </p>
                {selectedTranscriptMatch ? (
                  <Code
                    aria-label="Selected transcript match"
                    className="sessions-code"
                    content={transcriptMessageToPlainText(selectedTranscriptMatch)}
                  />
                ) : null}
                {exportPreview ? (
                  <details className="sessions-export-preview" open>
                    <summary>{t("preparedExport", { format: exportPreview.format })}</summary>
                    <Code
                      aria-label={t("preparedExport", { format: exportPreview.format })}
                      className="sessions-code"
                      content={exportPreview.text}
                      language={exportPreview.format}
                    />
                  </details>
                ) : null}
                {transcriptMessages.length > 0 ? (
                  <ul className="sessions-list sessions-transcript-list">
                    {transcriptMessages.slice(0, 8).map((message, index) => (
                      <li
                        className={
                          index === selectedTranscriptMatchIndex
                            ? "sessions-transcript-row is-selected"
                            : "sessions-transcript-row"
                        }
                        key={message.id ?? index}
                      >
                        <strong>{message.role ?? t("message")}</strong>
                        <p className="sessions-note">{transcriptMessageToPlainText(message)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sessions-empty">{t("noSessionUsageLogs")}</p>
                )}
              </section>
            </div>
          </Card>
        </section>

        <aside className="sessions-column sessions-column--inspector">
          <Card className="sessions-card sessions-inspector-card" padded={false}>
            <div className="sessions-card__header">
              <div>
                <h3>{t("inspectorTitle")}</h3>
                <p>{t("inspectorDescription")}</p>
              </div>
              <Badge>{t("defaultOpen")}</Badge>
            </div>
            <div className="sessions-card__body">
              <SegmentedControl<SessionInspectorTab>
                aria-label={t("inspectorTabs")}
                className="sessions-inspector-tabs"
                controlSize="xs"
                items={inspectorItems}
                value={activeInspectorTab}
                onChange={setActiveInspectorTab}
              />
              {error ? <p className="sessions-error">{error}</p> : null}

              <section
                className="sessions-surface"
                hidden={activeInspectorTab !== "overview"}
                id="sessions-inspector-overview"
                role="tabpanel"
              >
                <div className="sessions-section-heading">
                  <h3>{t("metadata")}</h3>
                  {selectedSession ? (
                    <Badge variant={statusVariant(selectedSession.status)}>
                      {selectedSession.status || t("unknown")}
                    </Badge>
                  ) : null}
                </div>
                {selectedSession ? (
                  <>
                    <strong>{selectedSession.key}</strong>
                    <p className="sessions-note">
                      {t("providerModelLine", {
                        model: selectedSession.model || t("na"),
                        provider: selectedSession.modelProvider || t("na"),
                      })}
                    </p>
                    <p className="sessions-note">
                      {t("thinkingFastMode", {
                        fastMode: selectedSession.fastMode ? t("on") : t("off"),
                        thinking: selectedSession.thinkingLevel || t("off"),
                      })}
                    </p>
                    <div className="sessions-status-row">
                      <Badge>
                        {t("history")}: {history?.messages?.length ?? 0}
                      </Badge>
                      <Badge variant={lineageState === "ready" ? "ok" : "neutral"}>
                        {t("inspector.lineage")}: {t(lineageState)}
                      </Badge>
                      <Badge>
                        {t("inspector.usage")}: {formatCompactNumber(selectedTotalTokens)}
                      </Badge>
                      <Badge>
                        {t("inspector.compaction")}: {selectedSession.compactionCount ?? 0}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <p className="sessions-empty">{t("noActiveSession")}</p>
                )}
              </section>

              <section
                hidden={activeInspectorTab !== "usage"}
                id="sessions-inspector-usage"
                role="tabpanel"
              >
                {selectedSessionKey ? (
                  <SessionUsageDetails
                    compactionCount={selectedSession?.compactionCount}
                    sessionKey={selectedSessionKey}
                  />
                ) : (
                  <p className="sessions-empty">{t("noActiveSession")}</p>
                )}
              </section>

              <section
                hidden={activeInspectorTab !== "compaction"}
                id="sessions-inspector-compaction"
                role="tabpanel"
              >
                {selectedSessionKey ? (
                  <SessionCompactionHistory
                    compactionCount={selectedSession?.compactionCount}
                    sessionKey={selectedSessionKey}
                  />
                ) : (
                  <p className="sessions-empty">{t("noActiveSession")}</p>
                )}
              </section>

              <section
                hidden={activeInspectorTab !== "lineage"}
                id="sessions-inspector-lineage"
                role="tabpanel"
              >
                <SessionSubagentDetails
                  childSessionKeys={childSessionKeys}
                  isSubagent={selectedIsSubagent}
                  lineage={lineage}
                  lineageState={lineageState}
                  onOpenSubagents={() => navigateToPanel(ui, "subagents")}
                  onSelectSessionKey={setSelectedSessionKey}
                  parentSessionKey={parentSessionKey}
                  relationships={selectedSessionRelationships}
                />
              </section>

              <section
                className="sessions-actions-panel"
                hidden={activeInspectorTab !== "actions"}
                id="sessions-inspector-actions"
                role="tabpanel"
              >
                <div className="sessions-section-heading">
                  <div>
                    <h3>{t("actionsTitle")}</h3>
                    <p>{t("actionsDescription")}</p>
                  </div>
                </div>
                <label className="sessions-field">
                  <span>{t("modelOverride")}</span>
                  <Input
                    className="sessions-input"
                    inputSize="sm"
                    value={modelOverride}
                    onChange={(event) => setModelOverride(event.target.value)}
                    placeholder={t("modelPlaceholder")}
                  />
                </label>
                <label className="sessions-field">
                  <span>{t("sessionLabel")}</span>
                  <Input
                    className="sessions-input"
                    inputSize="sm"
                    value={labelOverride}
                    onChange={(event) => setLabelOverride(event.target.value)}
                    placeholder={t("labelPlaceholder")}
                  />
                </label>
                <div className="sessions-controls">
                  <label className="sessions-field">
                    <span>{t("thinkingLevel")}</span>
                    <Select
                      aria-label={t("sessionThinkingLevel")}
                      className="sessions-select"
                      selectSize="sm"
                      value={thinkingOverride}
                      onChange={(event) => setThinkingOverride(event.target.value)}
                    >
                      {THINKING_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="sessions-field">
                    <span>{t("fastMode")}</span>
                    <span className="sessions-toggle-field">
                      <Toggle
                        aria-label={t("sessionFastMode")}
                        checked={fastModeOverride}
                        onCheckedChange={setFastModeOverride}
                      />
                      <strong>{fastModeOverride ? t("on") : t("off")}</strong>
                    </span>
                  </label>
                </div>
                <div className="sessions-actions">
                  <Button
                    size="sm"
                    onClick={() => {
                      clearActionConfirmations();
                      void runAction(() =>
                        patchSessionMutation.mutateAsync({
                          sessionKey: selectedSessionKey,
                          model: modelOverride.trim(),
                        }),
                      );
                    }}
                    variant="primary"
                    disabled={!selectedSessionKey.trim() || !modelOverride.trim()}
                  >
                    {t("patchModel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      clearActionConfirmations();
                      void runAction(() =>
                        patchSessionMutation.mutateAsync({
                          sessionKey: selectedSessionKey,
                          label: labelOverride.trim() || null,
                          thinkingLevel: thinkingOverride === "off" ? null : thinkingOverride,
                          fastMode: fastModeOverride,
                        }),
                      );
                    }}
                    disabled={!selectedSessionKey.trim()}
                  >
                    {t("patchDirectives")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!resetConfirming) {
                        clearActionConfirmations("reset");
                        setResetConfirming(true);
                        return;
                      }
                      setResetConfirming(false);
                      void runAction(() =>
                        resetSessionMutation.mutateAsync({
                          sessionKey: selectedSessionKey,
                          reason: "reset",
                        }),
                      );
                    }}
                    disabled={!selectedSessionKey.trim()}
                  >
                    {resetConfirming ? t("confirmReset") : t("resetSession")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!clearConfirming) {
                        clearActionConfirmations("clear");
                        setClearConfirming(true);
                        return;
                      }
                      setClearConfirming(false);
                      void runAction(() =>
                        clearSessionMutation.mutateAsync({ sessionKey: selectedSessionKey }),
                      );
                    }}
                    disabled={!selectedSessionKey.trim()}
                  >
                    {clearConfirming ? t("confirmClear") : t("clearSession")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!compactConfirming) {
                        clearActionConfirmations("compact");
                        setCompactConfirming(true);
                        return;
                      }
                      setCompactConfirming(false);
                      void runAction(async () => {
                        const response =
                          await compactSessionMutation.mutateAsync(selectedSessionKey);
                        return {
                          ok: response.ok,
                          status: response.status,
                          key: selectedSessionKey,
                          action: "compact",
                        };
                      });
                    }}
                    disabled={!selectedSessionKey.trim()}
                  >
                    {compactConfirming ? t("confirmCompact") : t("compactSession")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!deleteConfirming) {
                        clearActionConfirmations("delete");
                        setDeleteConfirming(true);
                        return;
                      }
                      setDeleteConfirming(false);
                      void runAction(
                        () =>
                          deleteSessionMutation.mutateAsync({
                            sessionKey: selectedSessionKey,
                            agentId: selectedSession?.agentId ?? null,
                          }),
                        { preserveSelectedSession: false },
                      );
                    }}
                    disabled={!selectedSessionKey.trim()}
                  >
                    {deleteConfirming ? t("confirmDeleteShort") : t("deleteSession")}
                  </Button>
                </div>
                {actionResult ? (
                  <section className="sessions-surface sessions-action-result">
                    <div className="sessions-section-heading">
                      <div>
                        <h3>{t("latestAction")}</h3>
                        <p>{t("actionResultTitle")}</p>
                      </div>
                    </div>
                    <Code
                      aria-label={t("actionResultTitle")}
                      className="sessions-code"
                      content={formatJson(actionResult)}
                      language="json"
                    />
                  </section>
                ) : null}
              </section>
            </div>
          </Card>
        </aside>
      </section>
    </section>
  );
}
