import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCommandDiscovery } from "@/hooks/use-command-discovery";
import { getCachedTranscript, setCachedTranscript } from "@/lib/transcript-cache";
import { useChatStore, type ChatState } from "@/stores/chat";
import {
  useActiveSessionKey,
  useSessionA2UI,
  useSessionMessages,
  useSessionStreaming,
} from "@/stores/chat-hooks";
import {
  loadBlockPreferences,
  saveBlockPreferences,
  type ChatBlockPreferences,
} from "@/stores/chat-preferences";
import type { ChatMessage, SessionMeta, SessionState } from "@/stores/chat-types";
import { ArtifactContext } from "./artifact-context";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import type { ArtifactInfo } from "./artifacts/detectArtifact";
import { BlockFilterBar } from "./BlockFilterBar";
import { CanvasPanel } from "./CanvasPanel";
import "./chat-shell.css";
import {
  fetchChatSnapshot,
  fetchSessionList,
  persistChatProjection,
  setSessionMessageSubscription,
} from "./chat-api";
import { ChatContextBar } from "./ChatContextBar";
import { EmptyState } from "./EmptyState";
import { normalizeHistoryMessages } from "./history-normalize";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { RightPanel } from "./RightPanel";
import { SessionSidebar } from "./SessionSidebar";
import { initializeLocalCommands } from "./slash-command-executor";
import { SSEStatusBanner } from "./SSEStatusBanner";
import { SteerDialog } from "./SteerDialog";
import { ToolProgressBar } from "./ToolProgressBar";
import { TranscriptSearch } from "./TranscriptSearch";
import { useChatSSE } from "./useChatSSE";
import { applyChatVisualStateSeed, isChatVisualStateRequested } from "./visual-state-seed";

const SESSION_STATUSES = new Set<SessionState["status"]>([
  "running",
  "done",
  "failed",
  "killed",
  "timeout",
]);

function toSessionStatus(status: string | undefined): SessionState["status"] | undefined {
  return SESSION_STATUSES.has(status as SessionState["status"])
    ? (status as SessionState["status"])
    : undefined;
}

function upsertSessionMeta(meta: SessionMeta) {
  useChatStore.setState((state) => {
    const metas = [...state.sessionMetas];
    const index = metas.findIndex((entry) => entry.key === meta.key);
    if (index >= 0) {
      metas[index] = { ...metas[index], ...meta };
    } else {
      metas.unshift(meta);
    }
    return { sessionMetas: metas, sessionMeta: metas };
  });
}

function applySnapshotMeta(store: ChatState, sessionKey: string, meta: SessionMeta | null) {
  if (!meta) {
    return;
  }

  upsertSessionMeta(meta);
  store.updateSessionState(sessionKey, {
    status: toSessionStatus(meta.status),
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    runtimeMs: meta.runtimeMs,
    fastMode: meta.fastMode,
  });
}

function hasFilterableBlocks(messages: ChatMessage[]) {
  return messages.some((message) =>
    message.content.some(
      (block) =>
        block.type === "thinking" || block.type === "tool_use" || block.type === "tool_result",
    ),
  );
}

export function ChatPanel() {
  const t = useTranslations("chat");
  useCommandDiscovery();
  const activeSessionKey = useActiveSessionKey();
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const a2uiState = useSessionA2UI();
  const [blockPrefs, setBlockPrefs] =
    useState<Required<ChatBlockPreferences>>(loadBlockPreferences);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [suggestedText, setSuggestedText] = useState("");
  const [rightPanelMode, setRightPanelMode] = useState<"hidden" | "canvas" | "artifact">("hidden");
  const [activeArtifact, setActiveArtifact] = useState<ArtifactInfo | null>(null);
  const prevCanvasVisibleRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const steerContainerRef = useRef<HTMLDivElement>(null);
  const visualStateRequested = useMemo(() => isChatVisualStateRequested(), []);

  useEffect(() => {
    initializeLocalCommands();
  }, []);

  useEffect(() => {
    applyChatVisualStateSeed();
  }, []);

  useChatSSE();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setShowSearch(true);
        const scheduleFocus =
          typeof window.requestAnimationFrame === "function"
            ? window.requestAnimationFrame.bind(window)
            : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
        scheduleFocus(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const visible = Boolean(a2uiState?.visible);
    const wasVisible = prevCanvasVisibleRef.current;
    prevCanvasVisibleRef.current = visible;

    if (visible && !wasVisible) {
      setRightPanelMode("canvas");
      return;
    }
    if (!visible && wasVisible && rightPanelMode === "canvas") {
      setRightPanelMode("hidden");
    }
  }, [a2uiState?.visible, rightPanelMode]);

  useLayoutEffect(() => {
    setRightPanelMode("hidden");
    setActiveArtifact(null);
    prevCanvasVisibleRef.current = false;
  }, [activeSessionKey]);

  useEffect(() => {
    if (visualStateRequested) {
      return undefined;
    }

    let cancelled = false;
    void fetchSessionList(activeAgentId ?? undefined)
      .then((metas) => {
        if (cancelled) {
          return;
        }

        const store = useChatStore.getState();
        store.setSessionMetas(metas);
        if (store.activeSessionKey || metas.length === 0) {
          return;
        }

        const initialSession = activeAgentId
          ? (metas.find((meta) => meta.agentId === activeAgentId) ?? metas[0])
          : metas[0];
        if (!initialSession) {
          return;
        }
        store.setActiveSession(initialSession.key);
        if (initialSession.agentId) {
          store.setActiveAgent(initialSession.agentId);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeAgentId, visualStateRequested]);

  useEffect(() => {
    if (visualStateRequested) {
      return undefined;
    }
    if (!activeSessionKey) {
      return undefined;
    }

    void setSessionMessageSubscription({
      sessionKey: activeSessionKey,
      subscribed: true,
    }).catch(() => {});
    return () => {
      void setSessionMessageSubscription({
        sessionKey: activeSessionKey,
        subscribed: false,
      }).catch(() => {});
    };
  }, [activeSessionKey, visualStateRequested]);

  useEffect(() => {
    if (visualStateRequested) {
      return undefined;
    }
    if (!activeSessionKey) {
      return undefined;
    }

    const store = useChatStore.getState();
    const session = store.ensureSession(activeSessionKey);
    if (session.isStreaming) {
      return undefined;
    }
    const cachedMessages = getCachedTranscript(activeSessionKey, session.isStreaming);
    if (cachedMessages && cachedMessages.length > 0) {
      store.setMessages(activeSessionKey, cachedMessages);
    }

    let cancelled = false;
    void fetchChatSnapshot({
      sessionKey: activeSessionKey,
      agentId: activeAgentId ?? undefined,
    })
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        const latestStore = useChatStore.getState();
        if (latestStore.activeSessionKey !== activeSessionKey) {
          return;
        }

        const latestSession = latestStore.ensureSession(activeSessionKey);
        if (latestSession.isStreaming) {
          return;
        }

        const normalizedMessages = normalizeHistoryMessages(activeSessionKey, snapshot.messages);
        setCachedTranscript(activeSessionKey, normalizedMessages);
        if (!(normalizedMessages.length === 0 && latestSession.messages.length > 0)) {
          latestStore.setMessages(activeSessionKey, normalizedMessages);
        }
        applySnapshotMeta(latestStore, activeSessionKey, snapshot.meta);
        latestStore.setActiveApproval(activeSessionKey, snapshot.activeApproval);
        latestStore.setA2UIState(activeSessionKey, snapshot.a2uiState);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeAgentId, activeSessionKey, visualStateRequested]);

  const updateBlockPrefs = useCallback((next: ChatBlockPreferences) => {
    const normalized = {
      showThinking: next.showThinking ?? true,
      showToolUse: next.showToolUse ?? true,
      showToolResult: next.showToolResult ?? true,
    };
    setBlockPrefs(normalized);
    saveBlockPreferences(normalized);
  }, []);

  const focusSteerInput = useCallback(() => {
    const container = steerContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollIntoView?.({ behavior: "smooth", block: "center" });
    container.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  const handleOpenArtifact = useCallback(
    (artifact: ArtifactInfo) => {
      setActiveArtifact(artifact);
      setRightPanelMode("artifact");
      if (!activeSessionKey) {
        return;
      }
      const store = useChatStore.getState();
      const currentA2UI = store.sessions.get(activeSessionKey)?.a2uiState ?? null;
      if (currentA2UI?.visible) {
        store.setA2UIState(activeSessionKey, { visible: false });
        void Promise.resolve(
          persistChatProjection({
            sessionKey: activeSessionKey,
            a2uiState: useChatStore.getState().sessions.get(activeSessionKey)?.a2uiState ?? null,
          }),
        ).catch(() => {});
      }
    },
    [activeSessionKey],
  );

  const handleToggleArtifactPanel = useCallback(() => {
    setRightPanelMode((mode) =>
      mode === "artifact" ? "hidden" : activeArtifact ? "artifact" : mode,
    );
  }, [activeArtifact]);

  const handleCloseRightPanel = useCallback(() => {
    if (rightPanelMode === "canvas" && activeSessionKey) {
      const store = useChatStore.getState();
      store.setA2UIState(activeSessionKey, { visible: false });
      void Promise.resolve(
        persistChatProjection({
          sessionKey: activeSessionKey,
          a2uiState: useChatStore.getState().sessions.get(activeSessionKey)?.a2uiState ?? null,
        }),
      ).catch(() => {});
    }
    setRightPanelMode("hidden");
  }, [activeSessionKey, rightPanelMode]);

  const artifactContext = useMemo(
    () => ({
      onOpenArtifact: handleOpenArtifact,
      onToggleArtifactPanel: handleToggleArtifactPanel,
      artifactPanelOpen: rightPanelMode === "artifact",
    }),
    [handleOpenArtifact, handleToggleArtifactPanel, rightPanelMode],
  );

  const showCanvas = rightPanelMode === "canvas" && activeSessionKey && a2uiState;
  const showArtifact = rightPanelMode === "artifact" && activeArtifact;
  const showRightPanel = showCanvas || showArtifact;

  return (
    <ArtifactContext.Provider value={artifactContext}>
      <section
        className={`ds-chat-shell ${showRightPanel ? "ds-chat-shell--has-right-drawer" : ""}`.trim()}
        aria-label="Chat workspace"
      >
        <aside className="ds-chat-shell__sidebar">
          <SessionSidebar />
        </aside>

        <section className="ds-chat-shell__main">
          <SSEStatusBanner />
          <ChatContextBar onToggleSearch={() => setShowSearch((current) => !current)} />
          {isStreaming ? (
            <button
              className="ds-chat-shell__steer-shortcut"
              type="button"
              onClick={focusSteerInput}
            >
              {t("steerQuickAccess")}
            </button>
          ) : null}

          {showSearch ? (
            <TranscriptSearch
              messages={messages}
              query={search}
              onQueryChange={setSearch}
              inputRef={searchInputRef}
              onClose={() => setShowSearch(false)}
            />
          ) : null}

          <section className="ds-chat-shell__transcript" aria-label="Transcript">
            {!activeSessionKey ? (
              <EmptyState onSelectPrompt={setSuggestedText} />
            ) : (
              <MessageList blockPreferences={blockPrefs} />
            )}
          </section>

          {hasFilterableBlocks(messages) ? (
            <BlockFilterBar preferences={blockPrefs} onChange={updateBlockPrefs} />
          ) : null}

          <div ref={steerContainerRef}>
            <SteerDialog />
          </div>
          <ToolProgressBar />

          <div className="ds-chat-shell__composer">
            <MessageInput
              suggestedText={suggestedText}
              onSuggestedTextConsumed={() => setSuggestedText("")}
            />
          </div>
        </section>

        {showRightPanel ? (
          <RightPanel mode={rightPanelMode} onClose={handleCloseRightPanel}>
            {showCanvas ? <CanvasPanel onClose={handleCloseRightPanel} /> : null}
            {showArtifact ? (
              <ArtifactPanel artifact={activeArtifact} onClose={handleCloseRightPanel} />
            ) : null}
          </RightPanel>
        ) : null}
      </section>
    </ArtifactContext.Provider>
  );
}
