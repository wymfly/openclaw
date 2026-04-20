import { useEffect, useEffectEvent, useRef, useState } from "react";
import type {
  DeckGoChatHistoryResponse,
  DeckGoChatSnapshotResponse,
  DeckGoSessionDetailResponse,
  DeckGoServerEvent,
  DeckGoSessionMeta,
  DeckGoSessionMessageStreamEvent,
  DeckGoSessionPreviewEntry,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import {
  abortChatRun,
  createChatSession,
  fetchChatHistory,
  fetchChatSnapshot,
  fetchSessionDetail,
  fetchSessionPreviews,
  fetchSessions,
  sendChatMessage,
  streamEvents,
} from "../../api";
import {
  JsonDetails,
  SessionDetailCard,
  SessionListCard,
  SessionPreviewCard,
} from "../../shell-components";

const NOOP_CLEANUP = () => {};
import { parseServerEvent, summarizeServerEvent } from "../../stream-contract";
import {
  applyLiveMessageToSessionDetail,
  firstTextContent,
  patchPreviewText,
  patchSessionMeta,
  patchSessionsList,
  upsertTranscriptMessage,
} from "./chat-state";

type PanelLoadState = "idle" | "loading" | "ready";
type ChatActionState = "idle" | "sending" | "aborting";
type StreamState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

const PREVIEW_LIMIT = 8;
const LAST_EVENT_ID_KEY = "deckGoLastEventId";

function firstSessionKey(payload: DeckGoSessionsListResponse | null) {
  return payload?.sessions?.[0]?.key ?? "";
}

export function RestoredChatPanel() {
  const [sessions, setSessions] = useState<DeckGoSessionsListResponse | null>(null);
  const [sessionPreviews, setSessionPreviews] = useState<DeckGoSessionsPreviewResponse | null>(
    null,
  );
  const [sessionDetail, setSessionDetail] = useState<DeckGoSessionDetailResponse | null>(null);
  const [snapshot, setSnapshot] = useState<DeckGoChatSnapshotResponse | null>(null);
  const [history, setHistory] = useState<DeckGoChatHistoryResponse | null>(null);
  const [inventoryState, setInventoryState] = useState<PanelLoadState>("idle");
  const [transcriptState, setTranscriptState] = useState<PanelLoadState>("idle");
  const [chatActionState, setChatActionState] = useState<ChatActionState>("idle");
  const [error, setError] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [requestedModel, setRequestedModel] = useState("cpa/gpt-5.4");
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [serverStreamState, setServerStreamState] = useState<StreamState>("idle");
  const [liveTimeline, setLiveTimeline] = useState<string[]>([]);
  const [projectionGapReason, setProjectionGapReason] = useState("");
  const lastEventIdRef = useRef(
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(LAST_EVENT_ID_KEY)?.trim() || "",
  );
  const previousServerStreamStateRef = useRef<StreamState>("idle");

  const selectedSessionMeta =
    sessions?.sessions?.find((session) => session.key === sessionKey) ??
    sessionDetail?.session ??
    snapshot?.session ??
    null;

  const hydrateSessionRead = useEffectEvent(
    async (targetSessionKey: string, targetAgentId: string) => {
      const trimmedSessionKey = targetSessionKey.trim();
      if (!trimmedSessionKey) {
        setTranscriptState("idle");
        setSessionDetail(null);
        setSnapshot(null);
        setHistory(null);
        return;
      }

      setTranscriptState("loading");
      try {
        const trimmedAgentId = targetAgentId.trim();
        const [detailResult, snapshotResult, historyResult] = await Promise.all([
          fetchSessionDetail({
            sessionKey: trimmedSessionKey,
            ...(trimmedAgentId ? { agentId: trimmedAgentId } : {}),
          }),
          fetchChatSnapshot({
            sessionKey: trimmedSessionKey,
            ...(trimmedAgentId ? { agentId: trimmedAgentId } : {}),
          }),
          fetchChatHistory({ sessionKey: trimmedSessionKey, limit: 50 }),
        ]);
        setSessionDetail(detailResult);
        setSnapshot(snapshotResult);
        setHistory(historyResult);
        setTranscriptState("ready");
        setError("");
      } catch (loadError) {
        setTranscriptState("idle");
        setError(
          loadError instanceof Error ? loadError.message : "failed to hydrate selected session",
        );
      }
    },
  );

  const applyLiveMessage = useEffectEvent((payload: DeckGoSessionMessageStreamEvent) => {
    if (!payload.message || payload.sessionKey !== sessionKey) {
      return;
    }

    const previewText = firstTextContent(payload.message);
    setSessionDetail((current) => applyLiveMessageToSessionDetail(current, payload));
    setSnapshot((current) =>
      current
        ? {
            ...current,
            messages: upsertTranscriptMessage(current.messages, payload.message!),
          }
        : current,
    );
    setHistory((current) =>
      current
        ? {
            ...current,
            messages: upsertTranscriptMessage(current.messages, payload.message!),
          }
        : current,
    );
    setSessions((current) =>
      current
        ? {
            ...current,
            sessions: (current.sessions ?? []).map((session) =>
              session.key === payload.sessionKey
                ? {
                    ...session,
                    lastMessagePreview: previewText || session.lastMessagePreview,
                    updatedAt: payload.updatedAt ?? session.updatedAt,
                    status: payload.status || session.status,
                  }
                : session,
            ),
          }
        : current,
    );
    if (previewText) {
      setSessionPreviews((current) => patchPreviewText(current, payload.sessionKey, previewText));
    }
  });

  const applySessionChange = useEffectEvent((payload: Parameters<typeof patchSessionMeta>[1]) => {
    setSessions((current) => patchSessionsList(current, payload));
    if (payload.sessionKey !== sessionKey) {
      return;
    }
    setSessionDetail((current) =>
      current
        ? {
            ...current,
            session: patchSessionMeta(current.session ?? { key: payload.sessionKey }, payload),
          }
        : current,
    );
    setSnapshot((current) =>
      current
        ? {
            ...current,
            session: patchSessionMeta(current.session ?? { key: payload.sessionKey }, payload),
          }
        : current,
    );
    if (payload.runId) {
      setRunId(payload.runId);
    }
  });

  const refreshSessionsInventory = useEffectEvent(
    async (options?: { preferredSessionKey?: string; preserveSelection?: boolean }) => {
      setInventoryState("loading");
      try {
        const sessionsResult = await fetchSessions();
        const sessionList = sessionsResult.sessions ?? [];
        const previewKeys = sessionList.slice(0, PREVIEW_LIMIT).map((session) => session.key);
        const previewsResult =
          previewKeys.length > 0 ? await fetchSessionPreviews(previewKeys) : { previews: [] };

        setSessions(sessionsResult);
        setSessionPreviews(previewsResult);
        setInventoryState("ready");
        setError("");

        const preferredKey = options?.preferredSessionKey?.trim() || "";
        const currentSelection = options?.preserveSelection ? sessionKey.trim() : "";
        const nextSelection =
          preferredKey && sessionList.some((session) => session.key === preferredKey)
            ? preferredKey
            : currentSelection && sessionList.some((session) => session.key === currentSelection)
              ? currentSelection
              : firstSessionKey(sessionsResult);

        if (nextSelection) {
          const matchedSession = sessionList.find(
            (session: DeckGoSessionMeta) => session.key === nextSelection,
          );
          setSessionKey(nextSelection);
          setAgentId(matchedSession?.agentId ?? "");
        } else {
          setSessionKey("");
          setAgentId("");
          setSessionDetail(null);
          setSnapshot(null);
          setHistory(null);
          setTranscriptState("idle");
        }
      } catch (inventoryError) {
        setInventoryState("idle");
        setError(
          inventoryError instanceof Error
            ? inventoryError.message
            : "failed to load chat inventory",
        );
      }
    },
  );

  const scheduleTranscriptRefresh = useEffectEvent(
    (targetSessionKey: string, targetAgentId: string) => {
      const trimmedSessionKey = targetSessionKey.trim();
      if (!trimmedSessionKey) {
        return;
      }
      window.setTimeout(() => {
        void hydrateSessionRead(trimmedSessionKey, targetAgentId);
      }, 900);
    },
  );

  useEffect(() => {
    void refreshSessionsInventory();
  }, [refreshSessionsInventory]);

  useEffect(() => {
    if (!sessionKey.trim()) {
      setTranscriptState("idle");
      return;
    }
    void hydrateSessionRead(sessionKey, agentId);
  }, [agentId, hydrateSessionRead, sessionKey]);

  useEffect(() => {
    if (!sessionKey.trim()) {
      setServerStreamState("idle");
      return NOOP_CLEANUP;
    }

    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      initialLastEventId: lastEventIdRef.current,
      onStatusChange(status) {
        setServerStreamState(status);
      },
      onEvent(event: DeckGoServerEvent) {
        if (event.id) {
          lastEventIdRef.current = event.id;
          window.localStorage.setItem(LAST_EVENT_ID_KEY, event.id);
        }
        const parsed = parseServerEvent(event);
        if (parsed.kind === "projection.gap") {
          setProjectionGapReason(parsed.payload.reason || "unknown");
          setLiveTimeline((current) => [summarizeServerEvent(event), ...current].slice(0, 8));
          void hydrateSessionRead(sessionKey, agentId);
          return;
        }

        if (
          (parsed.kind === "session.message" ||
            parsed.kind === "session.tool" ||
            parsed.kind === "sessions.changed") &&
          parsed.payload.sessionKey === sessionKey
        ) {
          setLiveTimeline((current) => [summarizeServerEvent(event), ...current].slice(0, 8));
          if (parsed.kind === "session.message") {
            applyLiveMessage(parsed.payload);
          } else if (parsed.kind === "session.tool") {
            void hydrateSessionRead(sessionKey, agentId);
          } else if (parsed.kind === "sessions.changed") {
            applySessionChange(parsed.payload);
          }
        }

        if (parsed.kind === "sessions.changed") {
          applySessionChange(parsed.payload);
        }
      },
    }).catch((streamError) => {
      if (!controller.signal.aborted) {
        setError(
          streamError instanceof Error ? streamError.message : "failed to connect live stream",
        );
      }
    });

    return () => {
      controller.abort();
    };
  }, [agentId, applyLiveMessage, applySessionChange, hydrateSessionRead, sessionKey]);

  useEffect(() => {
    const previous = previousServerStreamStateRef.current;
    if (
      previous !== serverStreamState &&
      serverStreamState === "connected" &&
      (previous === "reconnecting" || previous === "error") &&
      sessionKey.trim()
    ) {
      setLiveTimeline((current) => ["stream reconnected", ...current].slice(0, 8));
      void hydrateSessionRead(sessionKey, agentId);
      void refreshSessionsInventory({ preferredSessionKey: sessionKey, preserveSelection: true });
    } else if (previous !== serverStreamState && serverStreamState === "reconnecting") {
      setLiveTimeline((current) => ["stream reconnecting", ...current].slice(0, 8));
    } else if (previous !== serverStreamState && serverStreamState === "error") {
      setLiveTimeline((current) => ["stream error", ...current].slice(0, 8));
    }
    previousServerStreamStateRef.current = serverStreamState;
  }, [agentId, hydrateSessionRead, refreshSessionsInventory, serverStreamState, sessionKey]);

  const onSelectSession = (session: DeckGoSessionMeta) => {
    setSessionKey(session.key);
    setAgentId(session.agentId ?? "");
    setRunId("");
    setActionResult(null);
    setProjectionGapReason("");
    setLiveTimeline([]);
  };

  const onSelectPreview = (preview: DeckGoSessionPreviewEntry) => {
    const matchedSession = sessions?.sessions?.find(
      (session: DeckGoSessionMeta) => session.key === preview.key,
    );
    if (matchedSession) {
      onSelectSession(matchedSession);
      return;
    }
    setSessionKey(preview.key);
    setRunId("");
  };

  const onCreateSession = async () => {
    try {
      setChatActionState("sending");
      const resolvedAgentId = agentId.trim();
      const result = await createChatSession({
        ...(resolvedAgentId ? { agentId: resolvedAgentId } : {}),
        ...(requestedModel.trim() ? { model: requestedModel.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setActionResult(result);
      const nextSessionKey = result.key ?? "";
      if (nextSessionKey) {
        setSessionKey(nextSessionKey);
      }
      if (result.runId) {
        setRunId(result.runId);
      }
      if (message.trim()) {
        setMessage("");
      }
      setChatActionState("idle");
      setError("");
      await refreshSessionsInventory({ preferredSessionKey: nextSessionKey || sessionKey });
      scheduleTranscriptRefresh(nextSessionKey || sessionKey, resolvedAgentId);
    } catch (createError) {
      setChatActionState("idle");
      setError(createError instanceof Error ? createError.message : "failed to create session");
    }
  };

  const onSendMessage = async () => {
    if (!message.trim()) {
      setError("message is required to send");
      return;
    }

    if (!sessionKey.trim()) {
      await onCreateSession();
      return;
    }

    try {
      setChatActionState("sending");
      const result = await sendChatMessage({
        sessionKey: sessionKey.trim(),
        message: message.trim(),
      });
      setActionResult(result);
      if (result.runId) {
        setRunId(result.runId);
      }
      setMessage("");
      setChatActionState("idle");
      setError("");
      scheduleTranscriptRefresh(sessionKey, agentId);
      await refreshSessionsInventory({ preferredSessionKey: sessionKey, preserveSelection: true });
    } catch (sendError) {
      setChatActionState("idle");
      setError(sendError instanceof Error ? sendError.message : "failed to send message");
    }
  };

  const onAbortRun = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to abort");
      return;
    }

    try {
      setChatActionState("aborting");
      const result = await abortChatRun({
        sessionKey: sessionKey.trim(),
        ...(runId.trim() ? { runId: runId.trim() } : {}),
      });
      setActionResult(result);
      setRunId("");
      setChatActionState("idle");
      setError("");
      scheduleTranscriptRefresh(sessionKey, agentId);
    } catch (abortError) {
      setChatActionState("idle");
      setError(abortError instanceof Error ? abortError.message : "failed to abort run");
    }
  };

  return (
    <section className="deckgo-restored-chat-layout">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Session browser</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Legacy chat restoration now reads session inventory through deck-go contracts instead of
            the old monolithic workbench shell.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span
                className={`deckgo-pill ${inventoryState === "ready" ? "is-positive" : "is-muted"}`}
              >
                Inventory {inventoryState}
              </span>
              <span
                className={`deckgo-pill ${transcriptState === "ready" ? "is-positive" : "is-muted"}`}
              >
                Transcript {transcriptState}
              </span>
              <span
                className={`deckgo-pill ${chatActionState === "idle" ? "is-muted" : "is-primary"}`}
              >
                Composer {chatActionState}
              </span>
              <span
                className={`deckgo-pill ${serverStreamState === "connected" ? "is-positive" : "is-muted"}`}
              >
                Stream {serverStreamState}
              </span>
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() =>
                  void refreshSessionsInventory({
                    preferredSessionKey: sessionKey,
                    preserveSelection: true,
                  })
                }
              >
                Refresh sessions
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void hydrateSessionRead(sessionKey, agentId)}
                disabled={!sessionKey.trim()}
              >
                Refresh transcript
              </button>
            </div>
            <SessionListCard
              sessions={sessions?.sessions ?? []}
              selectedKey={sessionKey}
              onSelect={onSelectSession}
            />
            <details>
              <summary>Preview overlays</summary>
              <div style={{ marginTop: 12 }}>
                <SessionPreviewCard
                  previews={sessionPreviews?.previews ?? []}
                  selectedKey={sessionKey}
                  onSelect={onSelectPreview}
                />
              </div>
            </details>
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Transcript workspace</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Session detail, snapshot alias, and history seam are restored here as the default chat
            landing instead of remaining buried in the legacy fallback surface.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-restored-hero-strip">
              <div>
                <p className="deckgo-kicker">Selected session</p>
                <strong>{selectedSessionMeta?.title || sessionKey || "No active session"}</strong>
                <p className="deckgo-note">
                  agent: {selectedSessionMeta?.agentId || agentId || "n/a"} | run: {runId || "idle"}
                </p>
              </div>
              <div className="deckgo-pill-row">
                <span className="deckgo-pill">model {requestedModel || "default"}</span>
                <span className="deckgo-pill">{history?.messages?.length ?? 0} history msgs</span>
              </div>
            </div>
            {projectionGapReason ? (
              <div className="deckgo-surface-tile">
                <p className="deckgo-surface-label">Continuity notice</p>
                <strong>projection.gap recovered</strong>
                <p className="deckgo-note">
                  Reason: {projectionGapReason}. The restored chat panel rehydrates the selected
                  session after stream gaps to preserve transcript continuity.
                </p>
              </div>
            ) : null}
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Live event tape</p>
              {liveTimeline.length === 0 ? (
                <p className="deckgo-note">No live session events captured yet.</p>
              ) : (
                <ul className="deckgo-shell-list">
                  {liveTimeline.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
            <SessionDetailCard detail={sessionDetail} snapshot={snapshot} history={history} />
          </div>
        </article>
      </div>

      <aside className="deckgo-column">
        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Composer + context</h2>
          </div>
          <p className="deckgo-card-subtitle">
            The restored chat panel keeps only chat-local controls here. Deck-go local settings now
            live in the dedicated Settings panel.
          </p>
          <div className="deckgo-card-body deckgo-form-grid">
            <label className="deckgo-label">
              <span>Agent ID</span>
              <input
                className="deckgo-input"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                placeholder="main"
              />
            </label>
            <label className="deckgo-label">
              <span>Model override</span>
              <input
                className="deckgo-input"
                value={requestedModel}
                onChange={(event) => setRequestedModel(event.target.value)}
                placeholder="cpa/gpt-5.4"
              />
            </label>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Session context</p>
              <strong>{sessionKey || "No active session"}</strong>
              <p className="deckgo-note">run: {runId || "idle"}</p>
            </div>
            <label className="deckgo-label">
              <span>Message</span>
              <textarea
                className="deckgo-textarea"
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Send a message through the restored chat panel"
              />
            </label>
            <div className="deckgo-actions">
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void onCreateSession()}
              >
                Create session
              </button>
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void onSendMessage()}
              >
                Send message
              </button>
              <button
                className="deckgo-button is-danger"
                type="button"
                onClick={() => void onAbortRun()}
              >
                Abort run
              </button>
            </div>
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
              <details>
                <summary>Action result seam</summary>
                <div style={{ marginTop: 12 }}>
                  <JsonDetails title="Action result" payload={actionResult} />
                </div>
              </details>
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}
