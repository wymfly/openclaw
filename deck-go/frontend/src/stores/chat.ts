import { abortSession } from "./chat-abort";
import { registerDefaultChatStoreAPI } from "./chat-dispatchers";
import type {
  ContentBlock,
  ChatMessage,
  SessionState,
  SessionMeta,
  SessionPreviewOverlay,
  A2UIState,
  A2UIEvent,
  ToolProgress,
  ApprovalRequest,
  RunMetadata,
  SSEConnectionStatus,
} from "./chat-types";
import { createEmptySessionState, MAX_CACHED_SESSIONS, MAX_A2UI_EVENT_LOG } from "./chat-types";
import { createLocalStore } from "./create-local-store";

// ---------------------------------------------------------------------------
// Re-exports for consumers that import store-owned types from chat.ts.
// ---------------------------------------------------------------------------

export type { ChatMessage, ContentBlock, SessionMeta, ApprovalRequest };
export { type SessionState } from "./chat-types";

// Re-export kept for existing consumers (SessionSidebar, ChatPanel, etc.).
export type { SessionInfo } from "./chat-types";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ChatState {
  sessions: Map<string, SessionState>;
  sessionMetas: SessionMeta[];
  /** Alias for sessionMetas; used by tests and existing consumers. */
  sessionMeta: SessionMeta[];
  sessionPreviewOverlays: Record<string, SessionPreviewOverlay | undefined>;
  activeSessionKey: string | null;
  activeAgentId: string | null;
  sseStatus: SSEConnectionStatus;

  // Session management
  ensureSession: (key: string) => SessionState;
  setActiveSession: (key: string | null) => void;
  removeSession: (key: string) => void;
  /** Evict sessions idle longer than idleThresholdMs (skips active and activeSessionKey). */
  evictStale: (idleThresholdMs: number) => void;

  // Message operations (all session-scoped)
  addMessage: (sessionKey: string, msg: ChatMessage) => void;
  updateStreamingContent: (sessionKey: string, msgId: string, content: ContentBlock[]) => void;
  /** Alias for updateStreamingContent. */
  updateStreamingBlocks: (sessionKey: string, msgId: string, content: ContentBlock[]) => void;
  appendContentBlock: (sessionKey: string, msgId: string, block: ContentBlock) => void;
  finalizeMessage: (sessionKey: string, msgId: string) => void;
  /** Alias for finalizeMessage. */
  finalizeStreamingMessage: (sessionKey: string, msgId: string) => void;
  /** Replace all content blocks on a message and mark it as not streaming. */
  replaceMessageContent: (sessionKey: string, msgId: string, content: ContentBlock[]) => void;
  setMessages: (sessionKey: string, messages: ChatMessage[]) => void;
  clearMessages: (sessionKey: string) => void;
  resetSessionProjection: (sessionKey: string) => void;

  // Session state
  setSessionStreaming: (sessionKey: string, streaming: boolean) => void;
  /** Convenience: sets isStreaming + status + streamingRunId in a single mutation. */
  setStreaming: (sessionKey: string, streaming: boolean, runId?: string) => void;
  setSessionError: (sessionKey: string, error: string | null) => void;
  /** Alias for setSessionError. */
  setError: (sessionKey: string, error: string | null) => void;
  setRunMetadata: (sessionKey: string, msgId: string, metadata: Partial<RunMetadata>) => void;

  // A2UI Canvas (session-scoped)
  updateA2UIBridgeStatus: (sessionKey: string, status: "connecting" | "ready" | "error") => void;
  appendA2UIEvent: (sessionKey: string, event: A2UIEvent) => void;
  updateA2UISurfaces: (sessionKey: string, surfaces: string[]) => void;
  setA2UIState: (sessionKey: string, patch: Partial<A2UIState> | null) => void;

  // Tool progress (session-scoped)
  updateToolProgress: (sessionKey: string, toolUseId: string, progress: ToolProgress) => void;
  updateSessionState: (
    sessionKey: string,
    patch: Partial<
      Pick<SessionState, "status" | "startedAt" | "endedAt" | "runtimeMs" | "fastMode">
    >,
  ) => void;

  // Approval (session-scoped)
  setActiveApproval: (sessionKey: string, approval: ApprovalRequest | null) => void;

  // Canvas command queue (consumed by CanvasPanel when mounted)
  canvasCommands: Array<{
    sessionKey: string;
    action: string;
    params?: Record<string, unknown>;
    evalId?: string;
    javaScript?: string;
  }>;
  pushCanvasCommand: (
    sessionKey: string,
    cmd: {
      action: string;
      params?: Record<string, unknown>;
      evalId?: string;
      javaScript?: string;
    },
  ) => void;
  consumeCanvasCommands: (sessionKey: string) => Array<{
    sessionKey: string;
    action: string;
    params?: Record<string, unknown>;
    evalId?: string;
    javaScript?: string;
  }>;

  // Session list
  setSessionMetas: (metas: SessionMeta[]) => void;
  /** Alias for setSessionMetas; used by tests and existing consumers. */
  setSessionMeta: (metas: SessionMeta[]) => void;
  mergeSessionPreviewOverlay: (sessionKey: string, overlay: SessionPreviewOverlay) => void;
  clearSessionPreviewOverlay: (sessionKey: string) => void;
  setActiveAgent: (agentId: string | null) => void;
  setSSEStatus: (status: SSEConnectionStatus) => void;
}

function pruneSessionPreviewOverlays(
  overlays: Record<string, SessionPreviewOverlay | undefined>,
  validKeys: Set<string>,
): Record<string, SessionPreviewOverlay | undefined> {
  return Object.fromEntries(
    Object.entries(overlays).filter(([key]) => validKeys.has(key)),
  ) as Record<string, SessionPreviewOverlay | undefined>;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useChatStore = createLocalStore<ChatState>((set, get) => ({
  sessions: new Map<string, SessionState>(),
  sessionMetas: [],
  // sessionMeta is always kept in sync with sessionMetas (same reference)
  sessionMeta: [],
  sessionPreviewOverlays: {},
  activeSessionKey: null,
  activeAgentId: null,
  sseStatus: "disconnected" as SSEConnectionStatus,

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  ensureSession: (key) => {
    const state = get();
    const existing = state.sessions.get(key);
    if (existing) {
      // Touch lastAccessedAt
      const updated = { ...existing, lastAccessedAt: Date.now() };
      const next = new Map(state.sessions);
      next.set(key, updated);
      set({ sessions: next });
      return updated;
    }

    // Eviction: if at capacity, remove the oldest non-active, non-streaming session
    const sessions = new Map(state.sessions);
    if (sessions.size >= MAX_CACHED_SESSIONS) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of sessions) {
        if (k === state.activeSessionKey) {
          continue;
        }
        if (v.isStreaming) {
          continue;
        }
        if (v.lastAccessedAt < oldestTime) {
          oldestTime = v.lastAccessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        sessions.delete(oldestKey);
      }
    }

    const fresh = createEmptySessionState();
    sessions.set(key, fresh);
    set({ sessions });
    return fresh;
  },

  setActiveSession: (key) => {
    if (key) {
      // Ensure the session exists in the map
      get().ensureSession(key);
    }
    set({ activeSessionKey: key });
  },

  removeSession: (key) => {
    // Abort any in-flight request for this session
    abortSession(key);
    set((s) => {
      const next = new Map(s.sessions);
      next.delete(key);
      const updatedMetas = s.sessionMetas.filter((m) => m.key !== key);
      const overlays = { ...s.sessionPreviewOverlays };
      delete overlays[key];
      const patch: Partial<ChatState> = {
        sessions: next,
        sessionMetas: updatedMetas,
        sessionMeta: updatedMetas,
        sessionPreviewOverlays: overlays,
      };
      if (s.activeSessionKey === key) {
        (patch as Record<string, unknown>).activeSessionKey = null;
      }
      return patch as ChatState;
    });
  },

  // -------------------------------------------------------------------------
  // Message operations
  // -------------------------------------------------------------------------

  addMessage: (sessionKey, msg) =>
    set((s) => {
      const session = s.sessions.get(sessionKey) ?? createEmptySessionState();
      // Deduplicate by id
      if (s.sessions.has(sessionKey) && session.messages.some((m) => m.id === msg.id)) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages: [...session.messages, msg],
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  updateStreamingContent: (sessionKey, msgId, content) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages: session.messages.map((m) => (m.id === msgId ? { ...m, content } : m)),
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  appendContentBlock: (sessionKey, msgId, block) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages: session.messages.map((m) => {
          if (m.id !== msgId) {
            return m;
          }
          // For tool_use blocks, deduplicate by block.id
          if (
            block.type === "tool_use" &&
            m.content.some((b) => b.type === "tool_use" && b.id === block.id)
          ) {
            return m;
          }
          return { ...m, content: [...m.content, block] };
        }),
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  finalizeMessage: (sessionKey, msgId) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages: session.messages.map((m) => (m.id === msgId ? { ...m, streaming: false } : m)),
        isStreaming: false,
        status: "idle",
        streamingRunId: null,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  setMessages: (sessionKey, messages) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      // Merge: keep SSE-only messages (UUID-like IDs not present in history) appended after history,
      // but filter out SSE messages that are echoes of history messages (same role + close timestamp).
      const historyIds = new Set(messages.map((m) => m.id));
      const isHistoryId = (id: string) => /^[^:]+:\d+:\d+$/.test(id);
      const sseOnly = session.messages.filter((m) => {
        if (historyIds.has(m.id) || isHistoryId(m.id)) {
          return false;
        }
        // Check if a history message with the same role and close timestamp exists.
        // This catches SSE messages that were added via chat/session-msg events
        // before history was loaded, preventing duplicates after reloadFullContent.
        const hasSameRoleInHistory = messages.some(
          (h) => h.role === m.role && Math.abs(h.timestamp - m.timestamp) < 60_000,
        );
        if (hasSameRoleInHistory) {
          return false;
        }
        return true;
      });
      const merged = sseOnly.length > 0 ? [...messages, ...sseOnly] : messages;
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages: merged,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  clearMessages: (sessionKey) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages: [],
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  resetSessionProjection: (sessionKey) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...createEmptySessionState(),
        fastMode: session.fastMode,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  // -------------------------------------------------------------------------
  // Session state
  // -------------------------------------------------------------------------

  setSessionStreaming: (sessionKey, streaming) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        isStreaming: streaming,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  setStreaming: (sessionKey, streaming, runId) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        isStreaming: streaming,
        status: streaming ? "running" : "idle",
        streamingRunId: streaming ? (runId ?? session.streamingRunId) : null,
        // SLC-3: clear stale approval when streaming stops
        activeApproval: streaming ? session.activeApproval : null,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  setSessionError: (sessionKey, error) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        error,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  setRunMetadata: (sessionKey, msgId, metadata) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const existing = session.runMetadata[msgId] ?? ({} as RunMetadata);
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        runMetadata: {
          ...session.runMetadata,
          [msgId]: { ...existing, ...metadata },
        },
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  // -------------------------------------------------------------------------
  // A2UI Canvas (session-scoped)
  // -------------------------------------------------------------------------

  updateA2UIBridgeStatus: (sessionKey, status) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const a2ui: A2UIState = session.a2uiState ?? {
        visible: false,
      };
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        a2uiState: { ...a2ui, bridgeStatus: status },
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  appendA2UIEvent: (sessionKey, event) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const a2ui: A2UIState = session.a2uiState ?? {
        visible: false,
      };
      const log = [...(a2ui.eventLog ?? []), event];
      // Trim to max event log size
      const trimmed =
        log.length > MAX_A2UI_EVENT_LOG ? log.slice(log.length - MAX_A2UI_EVENT_LOG) : log;
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        a2uiState: { ...a2ui, eventLog: trimmed },
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  updateA2UISurfaces: (sessionKey, surfaces) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const a2ui: A2UIState = session.a2uiState ?? {
        visible: false,
      };
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        a2uiState: { ...a2ui, surfaces },
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  setA2UIState: (sessionKey, patch) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      if (patch === null) {
        // null clears the A2UI state entirely
        next.set(sessionKey, {
          ...session,
          a2uiState: null,
          lastAccessedAt: Date.now(),
        });
      } else {
        const a2ui: A2UIState = session.a2uiState ?? { visible: false };
        next.set(sessionKey, {
          ...session,
          a2uiState: { ...a2ui, ...patch },
          lastAccessedAt: Date.now(),
        });
      }
      return { sessions: next };
    }),

  // -------------------------------------------------------------------------
  // Tool progress (session-scoped)
  // -------------------------------------------------------------------------

  updateToolProgress: (sessionKey, toolUseId, progress) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        toolProgress: { ...session.toolProgress, [toolUseId]: progress },
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  updateSessionState: (sessionKey, patch) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        ...patch,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  // -------------------------------------------------------------------------
  // Approval (session-scoped)
  // -------------------------------------------------------------------------

  setActiveApproval: (sessionKey, approval) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        activeApproval: approval,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  // -------------------------------------------------------------------------
  // Canvas command queue
  // -------------------------------------------------------------------------

  canvasCommands: [],
  pushCanvasCommand: (sessionKey, cmd) =>
    set((s) => ({
      canvasCommands: [...s.canvasCommands, { sessionKey, ...cmd }],
    })),
  consumeCanvasCommands: (sessionKey) => {
    const cmds = get().canvasCommands.filter((cmd) => cmd.sessionKey === sessionKey);
    if (cmds.length > 0) {
      set((s) => ({
        canvasCommands: s.canvasCommands.filter((cmd) => cmd.sessionKey !== sessionKey),
      }));
    }
    return cmds;
  },

  // -------------------------------------------------------------------------
  // Session list
  // -------------------------------------------------------------------------

  setSessionMetas: (metas) =>
    set((s) => {
      const validKeys = new Set(metas.map((meta) => meta.key));
      return {
        sessionMetas: metas,
        sessionMeta: metas,
        sessionPreviewOverlays: pruneSessionPreviewOverlays(s.sessionPreviewOverlays, validKeys),
      };
    }),
  setSessionMeta: (metas) =>
    set((s) => {
      const validKeys = new Set(metas.map((meta) => meta.key));
      return {
        sessionMetas: metas,
        sessionMeta: metas,
        sessionPreviewOverlays: pruneSessionPreviewOverlays(s.sessionPreviewOverlays, validKeys),
      };
    }),
  mergeSessionPreviewOverlay: (sessionKey, overlay) =>
    set((s) => {
      const current = s.sessionPreviewOverlays[sessionKey];
      if (current) {
        if (current.updatedAt > overlay.updatedAt) {
          return s;
        }
        if (
          current.updatedAt === overlay.updatedAt &&
          current.source === "optimistic" &&
          overlay.source === "remote"
        ) {
          return s;
        }
      }
      return {
        sessionPreviewOverlays: {
          ...s.sessionPreviewOverlays,
          [sessionKey]: overlay,
        },
      };
    }),
  clearSessionPreviewOverlay: (sessionKey) =>
    set((s) => {
      if (!(sessionKey in s.sessionPreviewOverlays)) {
        return s;
      }
      const overlays = { ...s.sessionPreviewOverlays };
      delete overlays[sessionKey];
      return { sessionPreviewOverlays: overlays };
    }),
  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
  setSSEStatus: (status) => set({ sseStatus: status }),

  // -------------------------------------------------------------------------
  // Aliases (keep parity with tests and existing consumers)
  // -------------------------------------------------------------------------

  updateStreamingBlocks: (sessionKey, msgId, content) =>
    get().updateStreamingContent(sessionKey, msgId, content),

  finalizeStreamingMessage: (sessionKey, msgId) => get().finalizeMessage(sessionKey, msgId),

  replaceMessageContent: (sessionKey, msgId, content) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages: session.messages.map((m) =>
          m.id === msgId ? { ...m, content, streaming: false } : m,
        ),
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),

  setError: (sessionKey, error) => get().setSessionError(sessionKey, error),

  // -------------------------------------------------------------------------
  // Cache eviction
  // -------------------------------------------------------------------------

  evictStale: (idleThresholdMs) =>
    set((s) => {
      const now = Date.now();
      const next = new Map(s.sessions);
      for (const [k, v] of s.sessions) {
        if (k === s.activeSessionKey) {
          continue;
        }
        if (v.status === "running" || v.isStreaming) {
          continue;
        }
        if (now - v.lastAccessedAt > idleThresholdMs) {
          next.delete(k);
        }
      }
      if (next.size === s.sessions.size) {
        // Nothing removed — avoid creating a new reference
        return s;
      }
      return { sessions: next };
    }),
}));

// ---------------------------------------------------------------------------
// Wire the default ChatStoreAPI so dispatchers can work without explicit store
// ---------------------------------------------------------------------------

registerDefaultChatStoreAPI({
  ensureSession: (...a) => useChatStore.getState().ensureSession(...a),
  addMessage: (...a) => useChatStore.getState().addMessage(...a),
  updateStreamingContent: (...a) => useChatStore.getState().updateStreamingContent(...a),
  appendContentBlock: (...a) => useChatStore.getState().appendContentBlock(...a),
  finalizeMessage: (...a) => useChatStore.getState().finalizeMessage(...a),
  setSessionStreaming: (...a) => useChatStore.getState().setSessionStreaming(...a),
  setStreaming: (...a) => useChatStore.getState().setStreaming(...a),
  setSessionError: (...a) => useChatStore.getState().setSessionError(...a),
  setRunMetadata: (...a) => useChatStore.getState().setRunMetadata(...a),
  setActiveApproval: (...a) => useChatStore.getState().setActiveApproval(...a),
  appendA2UIEvent: (...a) => useChatStore.getState().appendA2UIEvent(...a),
  updateA2UISurfaces: (...a) => useChatStore.getState().updateA2UISurfaces(...a),
  setA2UIState: (...a) => useChatStore.getState().setA2UIState(...a),
  setMessages: (...a) => useChatStore.getState().setMessages(...a),
  getSessionMessages: (key) => useChatStore.getState().sessions.get(key)?.messages ?? [],
  updateToolProgress: (...a) => useChatStore.getState().updateToolProgress(...a),
  updateSessionState: (...a) => useChatStore.getState().updateSessionState(...a),
  resetSessionProjection: (...a) => useChatStore.getState().resetSessionProjection(...a),
  updateSessionMeta: (sessionKey, patch) => {
    useChatStore.setState((s) => {
      const idx = s.sessionMetas.findIndex((m) => m.key === sessionKey);
      if (idx < 0) {
        return {};
      }
      const metas = [...s.sessionMetas];
      metas[idx] = { ...metas[idx], ...patch };
      return { sessionMetas: metas, sessionMeta: metas };
    });
  },
});
