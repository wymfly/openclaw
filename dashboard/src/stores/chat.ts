import { create } from "zustand";
import { abortSession } from "./chat-abort";
import {
  type SessionState,
  type SessionMeta,
  type ChatMessage,
  type ContentBlock,
  type ApprovalRequest,
  type A2UIState,
  type A2UIEvent,
  type ToolProgress,
  createEmptySessionState,
  DEFAULT_EVICT_IDLE_MS,
  MAX_CACHED_SESSIONS,
  MAX_A2UI_EVENT_LOG,
} from "./chat-types";

// ---------------------------------------------------------------------------
// Re-export types so consumers can import from "@/stores/chat"
// ---------------------------------------------------------------------------

export {
  type ContentBlock,
  type ChatMessage,
  type ApprovalRequest,
  type SessionMeta,
  type SessionState,
  type A2UIState,
  type A2UIEvent,
  type ToolProgress,
} from "./chat-types";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ChatStore {
  // ---- Core state ----
  sessions: Map<string, SessionState>;
  activeSessionKey: string | null;
  activeAgentId: string | null;
  sessionMeta: SessionMeta[];

  // ---- Session-scoped actions ----
  ensureSession: (key: string) => void;
  addMessage: (sessionKey: string, msg: ChatMessage) => void;
  updateStreamingBlocks: (sessionKey: string, runId: string, blocks: ContentBlock[]) => void;
  finalizeStreamingMessage: (sessionKey: string, runId: string) => void;
  replaceMessageContent: (sessionKey: string, messageId: string, blocks: ContentBlock[]) => void;
  setMessages: (sessionKey: string, msgs: ChatMessage[]) => void;
  setStreaming: (sessionKey: string, streaming: boolean, runId?: string) => void;
  setError: (sessionKey: string, error: string | null) => void;
  setActiveApproval: (sessionKey: string, approval: ApprovalRequest | null) => void;
  updateToolProgress: (
    sessionKey: string,
    toolUseId: string,
    progress: Partial<ToolProgress>,
  ) => void;
  setA2UIState: (sessionKey: string, state: Partial<A2UIState> | null) => void;
  appendA2UIEvent: (sessionKey: string, event: A2UIEvent) => void;
  updateA2UIBridgeStatus: (sessionKey: string, status: "connecting" | "ready" | "error") => void;
  updateA2UISurfaces: (sessionKey: string, surfaces: string[]) => void;

  // ---- Global actions ----
  setActiveSession: (key: string | null) => void;
  setActiveAgent: (agentId: string | null) => void;
  removeSession: (key: string) => void;
  setSessionMeta: (meta: SessionMeta[]) => void;
  refreshSessionMeta: () => Promise<void>;
  evictStale: (maxIdleMs?: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Immutably update a single session in the Map.
 * Returns a new Map with the session at `key` replaced by `updater(existing)`.
 * If key doesn't exist, creates a new empty session first.
 */
function updateSession(
  sessions: Map<string, SessionState>,
  key: string,
  updater: (s: SessionState) => SessionState,
): Map<string, SessionState> {
  const newMap = new Map(sessions);
  const existing = newMap.get(key) ?? createEmptySessionState();
  newMap.set(key, updater(existing));
  return newMap;
}

/**
 * Check if an ID looks like a "history" message ID (contains colons),
 * as opposed to an SSE/run ID (typically UUID-like, no colons).
 */
function isHistoryId(id: string): boolean {
  return id.includes(":");
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatStore>((set, get) => ({
  // ---- Core state ----
  sessions: new Map<string, SessionState>(),
  activeSessionKey: null,
  activeAgentId: null,
  sessionMeta: [],

  // ---- Session-scoped actions ----

  ensureSession(key: string) {
    const { sessions } = get();
    if (sessions.has(key)) {
      // Update lastAccessedAt on existing session
      set({
        sessions: updateSession(sessions, key, (s) => ({
          ...s,
          lastAccessedAt: Date.now(),
        })),
      });
      return;
    }
    // Evict stale sessions before adding a new one if at capacity
    if (sessions.size >= MAX_CACHED_SESSIONS) {
      get().evictStale();
    }
    const newMap = new Map(get().sessions);
    newMap.set(key, createEmptySessionState());
    set({ sessions: newMap });
  },

  addMessage(sessionKey: string, msg: ChatMessage) {
    const { sessions } = get();
    const newSessions = updateSession(sessions, sessionKey, (s) => {
      // Idempotent: skip if msg.id already exists
      if (s.messages.some((m) => m.id === msg.id)) {
        return s;
      }
      return { ...s, messages: [...s.messages, msg] };
    });
    set({ sessions: newSessions });
  },

  updateStreamingBlocks(sessionKey: string, runId: string, blocks: ContentBlock[]) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === runId ? { ...m, content: blocks } : m)),
      })),
    });
  },

  finalizeStreamingMessage(sessionKey: string, runId: string) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === runId ? { ...m, streaming: false } : m)),
      })),
    });
  },

  replaceMessageContent(sessionKey: string, messageId: string, blocks: ContentBlock[]) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, content: blocks, streaming: false } : m,
        ),
      })),
    });
  },

  setMessages(sessionKey: string, msgs: ChatMessage[]) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => {
        // If session has no messages, just set them directly
        if (s.messages.length === 0) {
          return { ...s, messages: msgs };
        }

        // History-then-append strategy:
        // Identify SSE messages (non-history IDs) that should be preserved
        const sseMessages = s.messages.filter((m) => !isHistoryId(m.id));
        const historyIds = new Set(msgs.map((m) => m.id));

        // Filter out SSE messages whose IDs also appear in history (dedup)
        const uniqueSseMessages = sseMessages.filter((m) => !historyIds.has(m.id));

        // History first, then SSE messages appended
        return { ...s, messages: [...msgs, ...uniqueSseMessages] };
      }),
    });
  },

  setStreaming(sessionKey: string, streaming: boolean, runId?: string) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        isStreaming: streaming,
        streamingRunId: streaming ? (runId ?? s.streamingRunId) : null,
        status: streaming ? "active" : "idle",
      })),
    });
    // Trigger eviction when a session transitions to idle
    if (!streaming) {
      get().evictStale();
    }
  },

  setError(sessionKey: string, error: string | null) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        error,
      })),
    });
  },

  setActiveApproval(sessionKey: string, approval: ApprovalRequest | null) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        activeApproval: approval,
      })),
    });
  },

  updateToolProgress(sessionKey: string, toolUseId: string, progress: Partial<ToolProgress>) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        toolProgress: {
          ...s.toolProgress,
          [toolUseId]: { ...s.toolProgress[toolUseId], ...progress } as ToolProgress,
        },
      })),
    });
  },

  setA2UIState(sessionKey: string, state: Partial<A2UIState> | null) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        a2uiState:
          state === null ? null : { ...(s.a2uiState ?? { url: "", visible: false }), ...state },
      })),
    });
  },

  appendA2UIEvent(sessionKey: string, event: A2UIEvent) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => {
        const log = [...(s.a2uiState?.eventLog ?? []), event];
        if (log.length > MAX_A2UI_EVENT_LOG) {
          log.splice(0, log.length - MAX_A2UI_EVENT_LOG);
        }
        return {
          ...s,
          a2uiState: { ...(s.a2uiState ?? { url: "", visible: false }), eventLog: log },
        };
      }),
    });
  },

  updateA2UIBridgeStatus(sessionKey: string, status: "connecting" | "ready" | "error") {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        a2uiState: { ...(s.a2uiState ?? { url: "", visible: false }), bridgeStatus: status },
      })),
    });
  },

  updateA2UISurfaces(sessionKey: string, surfaces: string[]) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        a2uiState: { ...(s.a2uiState ?? { url: "", visible: false }), surfaces },
      })),
    });
  },

  // ---- Global actions ----

  setActiveSession(key: string | null) {
    if (key === null) {
      set({ activeSessionKey: null });
      return;
    }

    const { sessions } = get();
    if (sessions.has(key)) {
      // Cache hit — update lastAccessedAt
      set({
        activeSessionKey: key,
        sessions: updateSession(sessions, key, (s) => ({
          ...s,
          lastAccessedAt: Date.now(),
        })),
      });
    } else {
      // Cache miss — delegate to ensureSession (handles capacity check)
      get().ensureSession(key);
      set({ activeSessionKey: key });
    }
  },

  setActiveAgent(agentId: string | null) {
    set({ activeAgentId: agentId });
  },

  removeSession(key: string) {
    abortSession(key);
    const { sessions, sessionMeta } = get();
    const newMap = new Map(sessions);
    newMap.delete(key);
    set({
      sessions: newMap,
      sessionMeta: sessionMeta.filter((m) => m.key !== key),
    });
  },

  setSessionMeta(meta: SessionMeta[]) {
    set({ sessionMeta: meta });
  },

  async refreshSessionMeta() {
    try {
      const { activeAgentId } = get();
      const url = activeAgentId
        ? `/api/chat/sessions?agentId=${encodeURIComponent(activeAgentId)}`
        : "/api/chat/sessions";
      const res = await fetch(url);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as
        | { sessions?: Array<Record<string, unknown>> }
        | Array<Record<string, unknown>>;
      const list = Array.isArray(data) ? data : (data.sessions ?? []);
      if (Array.isArray(list)) {
        const meta: SessionMeta[] = list.map((s) => ({
          key: (s.key as string) ?? "",
          agentId: (s.agentId as string) ?? "",
          title: s.derivedTitle as string | undefined,
          updatedAt: (s.updatedAt as number) ?? Date.now(),
          lastMessagePreview: s.lastMessage as string | undefined,
        }));
        set({ sessionMeta: meta });
      }
    } catch {
      // Silently ignore fetch errors
    }
  },

  evictStale(maxIdleMs: number = DEFAULT_EVICT_IDLE_MS) {
    const { sessions, activeSessionKey } = get();
    const now = Date.now();
    const keysToEvict: string[] = [];

    for (const [key, sess] of sessions) {
      if (sess.status !== "idle") {
        continue;
      }
      if (key === activeSessionKey) {
        continue;
      }
      if (now - sess.lastAccessedAt >= maxIdleMs) {
        keysToEvict.push(key);
      }
    }

    if (keysToEvict.length === 0) {
      // Still create a new Map to satisfy immutability contract
      set({ sessions: new Map(sessions) });
      return;
    }

    const newMap = new Map(sessions);
    for (const key of keysToEvict) {
      abortSession(key);
      newMap.delete(key);
    }
    set({ sessions: newMap });
  },
}));
