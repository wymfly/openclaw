"use client";

import { createContext, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useCommandDiscovery } from "@/hooks/use-command-discovery";
import { useChatStore } from "@/stores/chat";
import {
  useSessionMessages,
  useActiveSessionKey,
  useSessionStreaming,
  useSessionA2UI,
} from "@/stores/chat-hooks";
import {
  loadBlockPreferences,
  saveBlockPreferences,
  type ChatBlockPreferences,
} from "@/stores/chat-preferences";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import type { ArtifactInfo } from "./artifacts/detectArtifact";
import { BlockFilterBar } from "./BlockFilterBar";
import { CanvasPanel } from "./CanvasPanel";
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
import { SessionConfigBar } from "./SessionConfigBar";
import { SessionSidebar } from "./SessionSidebar";
import { initializeLocalCommands } from "./slash-command-executor";
import { SSEStatusBanner } from "./SSEStatusBanner";
import { SteerDialog } from "./SteerDialog";
import { SubagentTree } from "./SubagentTree";
import { ToolProgressBar } from "./ToolProgressBar";
import { TranscriptSearch } from "./TranscriptSearch";
import { useChatSSE } from "./useChatSSE";

/** Context for artifact interactions — consumed by ToolResultCard and MessageInput. */
export const ArtifactContext = createContext<{
  onOpenArtifact: (artifact: ArtifactInfo) => void;
  onToggleArtifactPanel: () => void;
  artifactPanelOpen: boolean;
}>({ onOpenArtifact: () => {}, onToggleArtifactPanel: () => {}, artifactPanelOpen: false });

/**
 * Chat panel — entry point component.
 * Composes session sidebar, message list, and input area.
 */
export function ChatPanel() {
  useCommandDiscovery();

  useEffect(() => {
    initializeLocalCommands();
  }, []);

  const activeSessionKey = useActiveSessionKey();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const [blockPrefs, setBlockPrefs] = useState<ChatBlockPreferences>(loadBlockPreferences);
  const [showSearch, setShowSearch] = useState(false);

  // Cmd/Ctrl+F to toggle transcript search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fill message input from EmptyState suggested prompt
  const [suggestedText, setSuggestedText] = useState("");
  const handleSuggestedTextConsumed = useCallback(() => setSuggestedText(""), []);

  // Right panel state: hidden, canvas (A2UI), or artifact viewer
  const [rightPanelMode, setRightPanelMode] = useState<"hidden" | "canvas" | "artifact">("hidden");
  const [activeArtifact, setActiveArtifact] = useState<ArtifactInfo | null>(null);

  // A2UI canvas state — auto-show when agent pushes a surface update
  const a2uiState = useSessionA2UI();
  const prevCanvasVisibleRef = useRef(false);
  useEffect(() => {
    const visible = Boolean(a2uiState?.visible);
    const prevVisible = prevCanvasVisibleRef.current;
    prevCanvasVisibleRef.current = visible;

    if (visible && !prevVisible) {
      setRightPanelMode("canvas");
      return;
    }
    if (!visible && prevVisible && rightPanelMode === "canvas") {
      setRightPanelMode("hidden");
    }
  }, [a2uiState?.visible, rightPanelMode]);

  // Reset right panel when session changes
  useEffect(() => {
    setRightPanelMode("hidden");
    setActiveArtifact(null);
    prevCanvasVisibleRef.current = false;
  }, [activeSessionKey]);

  const handleOpenArtifact = useCallback(
    (artifact: ArtifactInfo) => {
      setActiveArtifact(artifact);
      setRightPanelMode("artifact");
      if (activeSessionKey) {
        const currentA2UI =
          useChatStore.getState().sessions.get(activeSessionKey)?.a2uiState ?? null;
        if (currentA2UI) {
          useChatStore.getState().setA2UIState(activeSessionKey, { visible: false });
          void persistChatProjection({
            sessionKey: activeSessionKey,
            a2uiState: useChatStore.getState().sessions.get(activeSessionKey)?.a2uiState ?? null,
          }).catch(() => {});
        }
      }
    },
    [activeSessionKey],
  );

  // Dev-only: expose handleOpenArtifact for browser-based functional testing
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      (window as unknown as Record<string, unknown>).__TEST_OPEN_ARTIFACT__ = handleOpenArtifact;
      return () => {
        delete (window as unknown as Record<string, unknown>).__TEST_OPEN_ARTIFACT__;
      };
    }
  }, [handleOpenArtifact]);

  const handleCloseRightPanel = useCallback(() => {
    if (rightPanelMode === "canvas" && activeSessionKey) {
      useChatStore.getState().setA2UIState(activeSessionKey, { visible: false });
      void persistChatProjection({
        sessionKey: activeSessionKey,
        a2uiState: useChatStore.getState().sessions.get(activeSessionKey)?.a2uiState ?? null,
      }).catch(() => {});
    }
    setRightPanelMode("hidden");
    // Keep activeArtifact so the toggle button can reopen it
  }, [activeSessionKey, rightPanelMode]);

  const handleToggleArtifactPanel = useCallback(() => {
    if (rightPanelMode === "artifact") {
      setRightPanelMode("hidden");
    } else if (activeArtifact) {
      setRightPanelMode("artifact");
    }
  }, [rightPanelMode, activeArtifact]);

  const artifactCtx = useMemo(
    () => ({
      onOpenArtifact: handleOpenArtifact,
      onToggleArtifactPanel: handleToggleArtifactPanel,
      artifactPanelOpen: rightPanelMode === "artifact",
    }),
    [handleOpenArtifact, handleToggleArtifactPanel, rightPanelMode],
  );

  const handleBlockPrefsChange = useCallback((prefs: ChatBlockPreferences) => {
    setBlockPrefs(prefs);
    saveBlockPreferences(prefs);
  }, []);

  // Show filter bar when there are tool/thinking blocks
  const hasFilterableBlocks = messages.some((m) =>
    m.content.some((b) => b.type === "thinking" || b.type === "tool_use"),
  );

  // Connect to SSE stream for real-time chat events.
  useChatSSE();

  // Fetch sessions on mount and when agent changes.
  useEffect(() => {
    void fetchSessionList(activeAgentId ?? undefined)
      .then((metas) => {
        useChatStore.getState().setSessionMetas(metas);
      })
      .catch(() => {});
  }, [activeAgentId]);

  useEffect(() => {
    if (!activeSessionKey) {
      return;
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
  }, [activeSessionKey]);

  // Fetch history when session changes.
  useEffect(() => {
    if (!activeSessionKey) {
      return;
    }
    // Skip history fetch while streaming — SSE messages are the source of truth.
    // History will be fetched via reloadFullContent after streaming completes.
    const session = useChatStore.getState().sessions.get(activeSessionKey);
    if (session?.isStreaming) {
      return;
    }
    void fetchChatSnapshot({
      sessionKey: activeSessionKey,
      agentId: activeAgentId ?? undefined,
    })
      .then((snapshot) => {
        const msgs = normalizeHistoryMessages(activeSessionKey, snapshot.messages);
        // For brand-new sessions the server returns empty history.
        // Preserve locally-added messages (e.g. the user message just sent)
        // to avoid a race where setMessages([]) wipes a pending outbound message.
        const store = useChatStore.getState();
        const currentMessages = store.sessions.get(activeSessionKey)?.messages ?? [];
        if (!(msgs.length === 0 && currentMessages.length > 0)) {
          store.setMessages(activeSessionKey, msgs);
        }

        const meta = snapshot.meta;
        if (meta) {
          useChatStore.setState((state) => {
            const metas = [...state.sessionMetas];
            const idx = metas.findIndex((sessionMeta) => sessionMeta.key === meta.key);
            if (idx >= 0) {
              metas[idx] = { ...metas[idx], ...meta };
            } else {
              metas.unshift(meta);
            }
            return { sessionMetas: metas, sessionMeta: metas };
          });
          store.updateSessionState(activeSessionKey, {
            status:
              meta.status === "running" ||
              meta.status === "done" ||
              meta.status === "failed" ||
              meta.status === "killed" ||
              meta.status === "timeout"
                ? meta.status
                : undefined,
            startedAt: meta.startedAt,
            endedAt: meta.endedAt,
            runtimeMs: meta.runtimeMs,
            fastMode: meta.fastMode,
          });
        }

        store.setActiveApproval(activeSessionKey, snapshot.activeApproval);
        store.setA2UIState(activeSessionKey, snapshot.a2uiState);
      })
      .catch(() => {});
  }, [activeSessionKey, activeAgentId]);

  // Suppress lint — isStreaming and messages are used through the hooks above
  void isStreaming;

  return (
    <ArtifactContext.Provider value={artifactCtx}>
      <div
        className="flex h-full rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--border)" }}
      >
        <SessionSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <SSEStatusBanner />
          <div className="flex items-center justify-end px-3 py-1 shrink-0">
            <ChatContextBar />
          </div>
          {showSearch && <TranscriptSearch onClose={() => setShowSearch(false)} />}
          {activeSessionKey ? (
            <MessageList blockPreferences={blockPrefs} />
          ) : (
            <EmptyState onSelectPrompt={setSuggestedText} />
          )}
          {hasFilterableBlocks && (
            <BlockFilterBar preferences={blockPrefs} onChange={handleBlockPrefsChange} />
          )}
          <SteerDialog />
          <SubagentTree />
          <ToolProgressBar />
          <SessionConfigBar />
          <MessageInput
            suggestedText={suggestedText}
            onSuggestedTextConsumed={handleSuggestedTextConsumed}
          />
        </div>
        <RightPanel mode={rightPanelMode} onClose={handleCloseRightPanel}>
          {rightPanelMode === "canvas" && <CanvasPanel onClose={handleCloseRightPanel} />}
          {rightPanelMode === "artifact" && activeArtifact && (
            <ArtifactPanel artifact={activeArtifact} onClose={handleCloseRightPanel} />
          )}
        </RightPanel>
      </div>
    </ArtifactContext.Provider>
  );
}
