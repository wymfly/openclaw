import { create } from "zustand";
import type {
  ContentBlock,
  ChatMessage,
  SessionState,
  SessionMeta,
  A2UIState,
  A2UIEvent,
  ToolProgress,
  ApprovalRequest,
  RunMetadata,
} from "./chat-types";
import { createEmptySessionState, MAX_CACHED_SESSIONS, MAX_A2UI_EVENT_LOG } from "./chat-types";

// ---------------------------------------------------------------------------
// Re-exports — backward compatibility for consumers that import from chat.ts
// ---------------------------------------------------------------------------

export type { ChatMessage, ContentBlock, SessionMeta, ApprovalRequest };
export { type SessionState } from "./chat-types";

// Legacy re-export kept for existing consumers (SessionSidebar, ChatPanel, etc.)
export type { SessionInfo } from "./chat-types";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ChatState {
  sessions: Map<string, SessionState>;
  sessionMetas: SessionMeta[];
  activeSessionKey: string | null;
  activeAgentId: string | null;

  // Session management
  ensureSession: (key: string) => SessionState;
  setActiveSession: (key: string | null) => void;
  removeSession: (key: string) => void;

  // Message operations (all session-scoped)
  addMessage: (sessionKey: string, msg: ChatMessage) => void;
  updateStreamingContent: (sessionKey: string, msgId: string, content: ContentBlock[]) => void;
  appendContentBlock: (sessionKey: string, msgId: string, block: ContentBlock) => void;
  finalizeMessage: (sessionKey: string, msgId: string) => void;
  setMessages: (sessionKey: string, messages: ChatMessage[]) => void;
  clearMessages: (sessionKey: string) => void;

  // Session state
  setSessionStreaming: (sessionKey: string, streaming: boolean) => void;
  setSessionError: (sessionKey: string, error: string | null) => void;
  setRunMetadata: (sessionKey: string, msgId: string, metadata: Partial<RunMetadata>) => void;

  // A2UI Canvas (session-scoped)
  updateA2UIBridgeStatus: (sessionKey: string, status: "connecting" | "ready" | "error") => void;
  appendA2UIEvent: (sessionKey: string, event: A2UIEvent) => void;
  updateA2UISurfaces: (sessionKey: string, surfaces: string[]) => void;
  setA2UIState: (sessionKey: string, patch: Partial<A2UIState>) => void;

  // Tool progress (session-scoped)
  updateToolProgress: (sessionKey: string, toolUseId: string, progress: ToolProgress) => void;

  // Approval (session-scoped)
  setActiveApproval: (sessionKey: string, approval: ApprovalRequest | null) => void;

  // Session list
  setSessionMetas: (metas: SessionMeta[]) => void;
  setActiveAgent: (agentId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: new Map<string, SessionState>(),
  sessionMetas: [],
  activeSessionKey: null,
  activeAgentId: null,

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
    set((s) => {
      const next = new Map(s.sessions);
      next.delete(key);
      const patch: Partial<ChatState> = { sessions: next };
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
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      // Deduplicate by id
      if (session.messages.some((m) => m.id === msg.id)) {
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
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        messages,
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
      const a2ui: A2UIState = session.a2uiState ?? {
        visible: false,
      };
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        a2uiState: { ...a2ui, ...patch },
        lastAccessedAt: Date.now(),
      });
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
  // Session list
  // -------------------------------------------------------------------------

  setSessionMetas: (metas) => set({ sessionMetas: metas }),
  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
}));
