import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { DeckGoSubagentsLineageResponse } from "../../../api";
import {
  clearSession,
  compactChatSession,
  deleteSession,
  fetchChatHistory,
  fetchSessionDetail,
  fetchSessionPreviews,
  fetchSessions,
  fetchSubagentLineage,
  patchSession,
  resetSession,
} from "../../../api";
import { navigateToPanel } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  JsonDetails,
  SessionDetailCard,
  SessionListCard,
  SessionPreviewCard,
  ShellStat,
} from "../../shared/ShellComponents";
import { SessionCompactionHistory } from "./SessionCompactionHistory";
import { SessionSubagentDetails, type SessionRelationshipMeta } from "./SessionSubagentDetails";
import { SessionUsageDetails } from "./SessionUsageDetails";

type PanelState = "idle" | "loading" | "ready";

type RefreshSessionsOptions = {
  preferredSessionKey?: string;
  preserveSelection?: boolean;
  currentSessionKey?: string;
};

function readSessionNavigationTarget() {
  if (typeof window === "undefined") {
    return { sessionKey: "" };
  }
  return {
    sessionKey: new URL(window.location.href).searchParams.get("sessionKey")?.trim() ?? "",
  };
}

const PREVIEW_LIMIT = 12;
const SESSION_FETCH_LIMIT = 200;
const SESSION_PAGE_SIZE = 20;
const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
type NormalizedHistoryMessages = ReturnType<typeof normalizeTranscriptMessages>;
type SessionKindFilter = "" | "direct" | "group" | "global" | "subagent";

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

export function SessionsPanel() {
  const ui = useDeckUI();
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
        const sessionsResult = await fetchSessions({
          ...(activeMinutesFilter ? { activeMinutes: Number(activeMinutesFilter) } : {}),
          limit: SESSION_FETCH_LIMIT,
          ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        });
        const previewKeys = (sessionsResult.sessions ?? [])
          .slice(0, PREVIEW_LIMIT)
          .map((session) => session.key);
        const previewResult =
          previewKeys.length > 0 ? await fetchSessionPreviews(previewKeys) : { previews: [] };
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
        setError(loadError instanceof Error ? loadError.message : "failed to load sessions");
      }
    },
    [activeMinutesFilter, searchQuery],
  );

  const refreshSelectedSession = useCallback(async (sessionKey: string) => {
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
        : fetchChatHistory({ sessionKey: trimmed, limit: 80 }).then((historyResult) => {
            const normalizedMessages = normalizeTranscriptMessages(
              trimmed,
              historyResult.messages as unknown as Array<Record<string, unknown>>,
            );
            setCachedTranscript(trimmed, normalizedMessages);
            return historyResponseFromMessages(normalizedMessages);
          });
      const [detailResult, historyResult] = await Promise.all([
        fetchSessionDetail({ sessionKey: trimmed }),
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
          const lineageResult = await fetchSubagentLineage({ sessionKey: trimmed });
          setLineage(lineageResult);
          setLineageState("ready");
        } catch (lineageError) {
          setLineageState("idle");
          setError(
            lineageError instanceof Error
              ? lineageError.message
              : "failed to load subagent lineage",
          );
          return;
        }
      }
      setError("");
    } catch (detailError) {
      setDetailState("idle");
      setLineage(null);
      setLineageState("idle");
      setError(
        detailError instanceof Error ? detailError.message : "failed to load session detail",
      );
    }
  }, []);

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
  const transcriptMessages = history?.messages ?? [];
  const transcriptMatchIndices = useMemo(
    () => findTranscriptMatches(transcriptMessages, transcriptSearchQuery),
    [transcriptMessages, transcriptSearchQuery],
  );
  const selectedTranscriptMatchIndex = transcriptMatchIndices[currentTranscriptMatch] ?? -1;
  const selectedTranscriptMatch =
    selectedTranscriptMatchIndex >= 0 ? transcriptMessages[selectedTranscriptMatchIndex] : null;

  useEffect(() => {
    setCurrentTranscriptMatch(0);
  }, [transcriptSearchQuery, selectedSessionKey]);

  useEffect(() => {
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
      setError(actionError instanceof Error ? actionError.message : "session action failed");
    }
  };

  const onSelectSession = (session: DeckGoSessionMeta) => {
    setSelectedSessionKey(session.key);
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-sessions">
      <div className="deckgo-column deck-ui-sessions-column">
        <article className="deckgo-card is-float deck-ui-sessions-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Session inventory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Sessions are now a dedicated browse/manage surface instead of staying embedded in chat.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-sessions-body">
            <div className="deckgo-pill-row deck-ui-sessions-status-row">
              <span
                className={`deckgo-pill ${inventoryState === "ready" ? "is-positive" : "is-muted"}`}
              >
                Inventory {inventoryState}
              </span>
              <span
                className={`deckgo-pill ${detailState === "ready" ? "is-positive" : "is-muted"}`}
              >
                Detail {detailState}
              </span>
              <span className="deckgo-pill">{filteredSessions.length} visible</span>
            </div>
            <label className="deckgo-label">
              <span>Search sessions</span>
              <input
                className="deckgo-input deck-ui-sessions-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="title, key, preview"
              />
            </label>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-sessions-controls">
              <label className="deckgo-label">
                <span>Session type</span>
                <select
                  aria-label="Session type filter"
                  className="deckgo-input deck-ui-sessions-input"
                  value={sessionKindFilter}
                  onChange={(event) =>
                    setSessionKindFilter(event.target.value as SessionKindFilter)
                  }
                >
                  <option value="">all types</option>
                  <option value="direct">direct</option>
                  <option value="group">group</option>
                  <option value="global">global</option>
                  <option value="subagent">subagent</option>
                </select>
              </label>
              <label className="deckgo-label">
                <span>Active window</span>
                <select
                  aria-label="Active minutes filter"
                  className="deckgo-input deck-ui-sessions-input"
                  value={activeMinutesFilter}
                  onChange={(event) => setActiveMinutesFilter(event.target.value)}
                >
                  <option value="">all time</option>
                  <option value="5">last 5m</option>
                  <option value="60">last 1h</option>
                  <option value="1440">last 24h</option>
                </select>
              </label>
            </div>
            <div className="deckgo-actions deck-ui-sessions-actions">
              <button
                className="deckgo-button deck-ui-sessions-button"
                type="button"
                onClick={() =>
                  void refreshSessionsInventory({
                    preferredSessionKey: selectedSessionKey,
                    preserveSelection: true,
                    currentSessionKey: selectedSessionKey,
                  })
                }
              >
                Refresh sessions
              </button>
              <button
                className="deckgo-button deck-ui-sessions-button"
                type="button"
                onClick={() => void refreshSelectedSession(selectedSessionKey)}
                disabled={!selectedSessionKey.trim()}
              >
                Refresh detail
              </button>
            </div>
            <div className="deck-ui-sessions-list-shell">
              <SessionListCard
                sessions={pagedSessions}
                selectedKey={selectedSessionKey}
                onSelect={onSelectSession}
              />
            </div>
            <div className="deckgo-actions deck-ui-sessions-actions deck-ui-sessions-pagination">
              <button
                className="deckgo-button deck-ui-sessions-button"
                disabled={sessionPage <= 1}
                onClick={() => setSessionPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous page
              </button>
              <span className="deckgo-note">
                page {sessionPage} of {totalSessionPages}
              </span>
              <button
                className="deckgo-button deck-ui-sessions-button"
                disabled={sessionPage >= totalSessionPages}
                onClick={() =>
                  setSessionPage((current) => Math.min(totalSessionPages, current + 1))
                }
                type="button"
              >
                Next page
              </button>
            </div>
            <details>
              <summary>Preview overlays</summary>
              <div className="deck-ui-sessions-preview-shell">
                <SessionPreviewCard
                  previews={previews?.previews ?? []}
                  selectedKey={selectedSessionKey}
                  onSelect={(preview) => setSelectedSessionKey(preview.key)}
                />
              </div>
            </details>
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-sessions-column deck-ui-sessions-detail-column">
        <article className="deckgo-card is-float deck-ui-sessions-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Session detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This panel keeps session inspection separate from the main chat workflow while still
            using deck-go session detail and history seams.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-sessions-body">
            <div className="deckgo-panel-hero-strip deck-ui-sessions-hero">
              <div>
                <p className="deckgo-kicker">Selected session</p>
                <strong>
                  {selectedSession?.title || selectedSessionKey || "No active session"}
                </strong>
                <p className="deckgo-note">
                  agent: {selectedSession?.agentId || "n/a"} | status:{" "}
                  {selectedSession?.status || "unknown"}
                </p>
              </div>
              <div className="deckgo-pill-row deck-ui-sessions-status-row">
                <span className="deckgo-pill">{history?.messages?.length ?? 0} history msgs</span>
                {selectedIsSubagent ? (
                  <span
                    className={`deckgo-pill ${lineageState === "ready" ? "is-positive" : "is-muted"}`}
                  >
                    lineage {lineageState}
                  </span>
                ) : null}
                <span className="deckgo-pill">
                  runtime{" "}
                  {selectedSession?.runtimeMs != null ? `${selectedSession.runtimeMs} ms` : "n/a"}
                </span>
                {selectedContextPressure != null ? (
                  <span className="deckgo-pill">context {selectedContextPressure}%</span>
                ) : null}
              </div>
            </div>
            {selectedSession ? (
              <div className="deckgo-surface-tile deck-ui-sessions-surface">
                <p className="deckgo-surface-label">Runtime metadata</p>
                <div className="deckgo-grid deckgo-grid-3 deck-ui-sessions-stats">
                  <ShellStat
                    label="input tokens"
                    value={formatCompactNumber(positiveNumber(selectedSession.inputTokens))}
                  />
                  <ShellStat
                    label="output tokens"
                    value={formatCompactNumber(positiveNumber(selectedSession.outputTokens))}
                  />
                  <ShellStat
                    label="total tokens"
                    value={formatCompactNumber(selectedTotalTokens)}
                  />
                  <ShellStat
                    label="context window"
                    value={formatCompactNumber(selectedContextTokens)}
                  />
                  <ShellStat
                    label="context pressure"
                    value={selectedContextPressure != null ? `${selectedContextPressure}%` : "n/a"}
                  />
                  <ShellStat
                    label="estimated cost"
                    value={formatCost(selectedSession.estimatedCostUsd)}
                  />
                </div>
                <p className="deckgo-note">
                  thinking: {selectedSession.thinkingLevel || "off"} | fast mode:{" "}
                  {selectedSession.fastMode ? "on" : "off"}
                </p>
              </div>
            ) : null}
            {selectedSessionKey ? (
              <SessionUsageDetails
                compactionCount={selectedSession?.compactionCount}
                sessionKey={selectedSessionKey}
              />
            ) : null}
            {selectedSessionKey ? (
              <SessionCompactionHistory
                compactionCount={selectedSession?.compactionCount}
                sessionKey={selectedSessionKey}
              />
            ) : null}
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
            <div className="deckgo-surface-tile deck-ui-sessions-surface">
              <p className="deckgo-surface-label">Transcript search and export</p>
              <div className="deckgo-grid">
                <input
                  className="deckgo-input deck-ui-sessions-input"
                  value={transcriptSearchQuery}
                  onChange={(event) => setTranscriptSearchQuery(event.target.value)}
                  placeholder="search transcript"
                />
              </div>
              <div className="deckgo-actions deck-ui-sessions-actions deck-ui-sessions-actions-offset">
                <button
                  className="deckgo-button deck-ui-sessions-button"
                  type="button"
                  onClick={() => moveTranscriptMatch(-1)}
                  disabled={transcriptMatchIndices.length === 0}
                >
                  Previous match
                </button>
                <button
                  className="deckgo-button deck-ui-sessions-button"
                  type="button"
                  onClick={() => moveTranscriptMatch(1)}
                  disabled={transcriptMatchIndices.length === 0}
                >
                  Next match
                </button>
                <button
                  className="deckgo-button deck-ui-sessions-button"
                  type="button"
                  onClick={() => prepareExport("json")}
                  disabled={!selectedSession || transcriptMessages.length === 0}
                >
                  Export JSON
                </button>
                <button
                  className="deckgo-button deck-ui-sessions-button"
                  type="button"
                  onClick={() => prepareExport("markdown")}
                  disabled={!selectedSession || transcriptMessages.length === 0}
                >
                  Export Markdown
                </button>
              </div>
              <p className="deckgo-note">
                {transcriptSearchQuery.trim()
                  ? transcriptMatchIndices.length > 0
                    ? `match ${currentTranscriptMatch + 1} of ${transcriptMatchIndices.length}`
                    : "no transcript matches"
                  : "enter a query to search loaded transcript history"}
              </p>
              {selectedTranscriptMatch ? (
                <pre className="deckgo-code deck-ui-sessions-code">
                  {transcriptMessageToPlainText(selectedTranscriptMatch)}
                </pre>
              ) : null}
              {exportPreview ? (
                <details open>
                  <summary>Prepared {exportPreview.format} export</summary>
                  <pre className="deckgo-code deck-ui-sessions-code">{exportPreview.text}</pre>
                </details>
              ) : null}
            </div>
            <div className="deck-ui-sessions-detail-shell">
              <SessionDetailCard detail={detail} snapshot={null} history={history} />
            </div>
          </div>
        </article>
      </div>

      <aside className="deckgo-column deck-ui-sessions-column deck-ui-sessions-action-column">
        <article className="deckgo-card deck-ui-sessions-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Session actions</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Reset, clear, and patch are moved here so chat can stay focused on conversation.
          </p>
          <div className="deckgo-card-body deckgo-form-grid deck-ui-sessions-body">
            <label className="deckgo-label">
              <span>Model override</span>
              <input
                className="deckgo-input deck-ui-sessions-input"
                value={modelOverride}
                onChange={(event) => setModelOverride(event.target.value)}
                placeholder="cpa/gpt-5.4"
              />
            </label>
            <label className="deckgo-label">
              <span>Session label</span>
              <input
                className="deckgo-input deck-ui-sessions-input"
                value={labelOverride}
                onChange={(event) => setLabelOverride(event.target.value)}
                placeholder="session label"
              />
            </label>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-sessions-controls">
              <label className="deckgo-label">
                <span>Thinking level</span>
                <select
                  aria-label="Session thinking level"
                  className="deckgo-input deck-ui-sessions-input"
                  value={thinkingOverride}
                  onChange={(event) => setThinkingOverride(event.target.value)}
                >
                  {THINKING_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="deckgo-label">
                <span>Fast mode</span>
                <input
                  aria-label="Session fast mode"
                  checked={fastModeOverride}
                  onChange={(event) => setFastModeOverride(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
            <div className="deckgo-actions deck-ui-sessions-actions">
              <button
                className="deckgo-button deck-ui-sessions-button"
                type="button"
                onClick={() =>
                  void runAction(() =>
                    resetSession({ sessionKey: selectedSessionKey, reason: "reset" }),
                  )
                }
                disabled={!selectedSessionKey.trim()}
              >
                Reset session
              </button>
              <button
                className="deckgo-button deck-ui-sessions-button"
                type="button"
                onClick={() =>
                  void runAction(() => clearSession({ sessionKey: selectedSessionKey }))
                }
                disabled={!selectedSessionKey.trim()}
              >
                Clear session
              </button>
              <button
                className="deckgo-button deck-ui-sessions-button is-primary"
                type="button"
                onClick={() =>
                  void runAction(() =>
                    patchSession({
                      sessionKey: selectedSessionKey,
                      model: modelOverride.trim(),
                    }),
                  )
                }
                disabled={!selectedSessionKey.trim() || !modelOverride.trim()}
              >
                Patch model
              </button>
              <button
                className="deckgo-button deck-ui-sessions-button"
                type="button"
                onClick={() =>
                  void runAction(() =>
                    patchSession({
                      sessionKey: selectedSessionKey,
                      label: labelOverride.trim() || null,
                      thinkingLevel: thinkingOverride === "off" ? null : thinkingOverride,
                      fastMode: fastModeOverride,
                    }),
                  )
                }
                disabled={!selectedSessionKey.trim()}
              >
                Patch directives
              </button>
              <button
                className="deckgo-button deck-ui-sessions-button"
                type="button"
                onClick={() => {
                  if (!compactConfirming) {
                    setCompactConfirming(true);
                    setDeleteConfirming(false);
                    return;
                  }
                  setCompactConfirming(false);
                  void runAction(async () => {
                    const response = await compactChatSession(selectedSessionKey);
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
                {compactConfirming ? "Confirm compact" : "Compact session"}
              </button>
              <button
                className="deckgo-button deck-ui-sessions-button is-danger"
                type="button"
                onClick={() => {
                  if (!deleteConfirming) {
                    setDeleteConfirming(true);
                    setCompactConfirming(false);
                    return;
                  }
                  setDeleteConfirming(false);
                  void runAction(
                    () =>
                      deleteSession({
                        sessionKey: selectedSessionKey,
                        agentId: selectedSession?.agentId ?? null,
                      }),
                    { preserveSelectedSession: false },
                  );
                }}
                disabled={!selectedSessionKey.trim()}
              >
                {deleteConfirming ? "Confirm delete" : "Delete session"}
              </button>
            </div>
            {selectedSession ? (
              <div className="deckgo-surface-tile deck-ui-sessions-surface">
                <p className="deckgo-surface-label">Metadata</p>
                <strong>{selectedSession.key}</strong>
                <p className="deckgo-note">
                  provider: {selectedSession.modelProvider || "n/a"} | model:{" "}
                  {selectedSession.model || "n/a"}
                </p>
              </div>
            ) : null}
            {error ? <p className="deckgo-note deck-ui-sessions-error">{error}</p> : null}
          </div>
        </article>

        {actionResult ? (
          <article className="deckgo-card deck-ui-sessions-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Latest action</h2>
            </div>
            <div className="deckgo-card-body">
              <JsonDetails title="Session action result" payload={actionResult} />
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}
