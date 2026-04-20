import { useEffect, useEffectEvent, useMemo, useState } from "react";
import type {
  DeckGoChatHistoryResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionMeta,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import {
  clearSession,
  fetchChatHistory,
  fetchSessionDetail,
  fetchSessionPreviews,
  fetchSessions,
  patchSession,
  resetSession,
} from "../../api";
import {
  JsonDetails,
  SessionDetailCard,
  SessionListCard,
  SessionPreviewCard,
} from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

const PREVIEW_LIMIT = 12;

function firstSessionKey(payload: DeckGoSessionsListResponse | null) {
  return payload?.sessions?.[0]?.key ?? "";
}

export function RestoredSessionsPanel() {
  const [sessions, setSessions] = useState<DeckGoSessionsListResponse | null>(null);
  const [previews, setPreviews] = useState<DeckGoSessionsPreviewResponse | null>(null);
  const [detail, setDetail] = useState<DeckGoSessionDetailResponse | null>(null);
  const [history, setHistory] = useState<DeckGoChatHistoryResponse | null>(null);
  const [inventoryState, setInventoryState] = useState<PanelState>("idle");
  const [detailState, setDetailState] = useState<PanelState>("idle");
  const [selectedSessionKey, setSelectedSessionKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [modelOverride, setModelOverride] = useState("cpa/gpt-5.4");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);

  const refreshSessionsInventory = useEffectEvent(
    async (options?: { preferredSessionKey?: string; preserveSelection?: boolean }) => {
      setInventoryState("loading");
      try {
        const sessionsResult = await fetchSessions();
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
        const current = options?.preserveSelection ? selectedSessionKey.trim() : "";
        const next =
          preferred && (sessionsResult.sessions ?? []).some((session) => session.key === preferred)
            ? preferred
            : current && (sessionsResult.sessions ?? []).some((session) => session.key === current)
              ? current
              : firstSessionKey(sessionsResult);

        setSelectedSessionKey(next);
      } catch (loadError) {
        setInventoryState("idle");
        setError(loadError instanceof Error ? loadError.message : "failed to load sessions");
      }
    },
  );

  const refreshSelectedSession = useEffectEvent(async (sessionKey: string) => {
    const trimmed = sessionKey.trim();
    if (!trimmed) {
      setDetail(null);
      setHistory(null);
      setDetailState("idle");
      return;
    }
    setDetailState("loading");
    try {
      const [detailResult, historyResult] = await Promise.all([
        fetchSessionDetail({ sessionKey: trimmed }),
        fetchChatHistory({ sessionKey: trimmed, limit: 80 }),
      ]);
      setDetail(detailResult);
      setHistory(historyResult);
      setDetailState("ready");
      setError("");
    } catch (detailError) {
      setDetailState("idle");
      setError(
        detailError instanceof Error ? detailError.message : "failed to load session detail",
      );
    }
  });

  useEffect(() => {
    void refreshSessionsInventory();
  }, [refreshSessionsInventory]);

  useEffect(() => {
    void refreshSelectedSession(selectedSessionKey);
  }, [refreshSelectedSession, selectedSessionKey]);

  const filteredSessions = useMemo(() => {
    const sessionList = sessions?.sessions ?? [];
    if (!searchQuery.trim()) {
      return sessionList;
    }
    const query = searchQuery.trim().toLowerCase();
    return sessionList.filter((session) => {
      const title = (session.title || session.key).toLowerCase();
      const preview = (session.lastMessagePreview || "").toLowerCase();
      return (
        title.includes(query) ||
        preview.includes(query) ||
        session.key.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, sessions]);

  const selectedSession =
    filteredSessions.find((session) => session.key === selectedSessionKey) ??
    sessions?.sessions?.find((session) => session.key === selectedSessionKey) ??
    detail?.session ??
    null;

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      const result = await action();
      setActionResult(result);
      await refreshSessionsInventory({
        preferredSessionKey: selectedSessionKey,
        preserveSelection: true,
      });
      await refreshSelectedSession(selectedSessionKey);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "session action failed");
    }
  };

  const onSelectSession = (session: DeckGoSessionMeta) => {
    setSelectedSessionKey(session.key);
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Session inventory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Sessions are now a dedicated browse/manage surface instead of staying embedded in chat.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
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
                className="deckgo-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="title, key, preview"
              />
            </label>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() =>
                  void refreshSessionsInventory({
                    preferredSessionKey: selectedSessionKey,
                    preserveSelection: true,
                  })
                }
              >
                Refresh sessions
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refreshSelectedSession(selectedSessionKey)}
                disabled={!selectedSessionKey.trim()}
              >
                Refresh detail
              </button>
            </div>
            <SessionListCard
              sessions={filteredSessions}
              selectedKey={selectedSessionKey}
              onSelect={onSelectSession}
            />
            <details>
              <summary>Preview overlays</summary>
              <div style={{ marginTop: 12 }}>
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

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Session detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This panel keeps session inspection separate from the main chat workflow while still
            using deck-go session detail and history seams.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-restored-hero-strip">
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
              <div className="deckgo-pill-row">
                <span className="deckgo-pill">{history?.messages?.length ?? 0} history msgs</span>
                <span className="deckgo-pill">
                  runtime{" "}
                  {selectedSession?.runtimeMs != null ? `${selectedSession.runtimeMs} ms` : "n/a"}
                </span>
              </div>
            </div>
            <SessionDetailCard detail={detail} snapshot={null} history={history} />
          </div>
        </article>
      </div>

      <aside className="deckgo-column">
        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Session actions</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Reset, clear, and patch are moved here so chat can stay focused on conversation.
          </p>
          <div className="deckgo-card-body deckgo-form-grid">
            <label className="deckgo-label">
              <span>Model override</span>
              <input
                className="deckgo-input"
                value={modelOverride}
                onChange={(event) => setModelOverride(event.target.value)}
                placeholder="cpa/gpt-5.4"
              />
            </label>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
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
                className="deckgo-button"
                type="button"
                onClick={() =>
                  void runAction(() => clearSession({ sessionKey: selectedSessionKey }))
                }
                disabled={!selectedSessionKey.trim()}
              >
                Clear session
              </button>
              <button
                className="deckgo-button is-primary"
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
            </div>
            {selectedSession ? (
              <div className="deckgo-surface-tile">
                <p className="deckgo-surface-label">Metadata</p>
                <strong>{selectedSession.key}</strong>
                <p className="deckgo-note">
                  provider: {selectedSession.modelProvider || "n/a"} | model:{" "}
                  {selectedSession.model || "n/a"}
                </p>
              </div>
            ) : null}
            {error ? (
              <p className="deckgo-note" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            ) : null}
          </div>
        </article>

        {actionResult ? (
          <article className="deckgo-card">
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
