import { create } from "zustand";

// ---------------------------------------------------------------------------
// Content block types (Anthropic-compatible discriminated union)
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; fileName?: string }
  | { type: "file"; data: string; mimeType: string; fileName: string; size?: number }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string | ContentBlock[]; isError?: boolean }
  | { type: "thinking"; text: string };

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: ContentBlock[];
  timestamp: number;
  /** Whether this message is still being streamed. */
  streaming?: boolean;
  /** Error associated with this message. */
  error?: string;
}

/**
 * Session info as consumed by the UI.
 *
 * Gateway `sessions.list` returns entries with fields like:
 *   { key, sessionId, agentId, derivedTitle?, lastMessage?, lastActivityAt?, ... }
 * We normalize to this shape.
 */
export type SessionInfo = {
  key: string;
  sessionId?: string;
  agentId?: string;
  title?: string;
  lastMessage?: string;
  updatedAt?: number;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  activeSessionId: string | null;
  activeAgentId: string | null;
  sessions: SessionInfo[];
  error: string | null;

  addMessage: (message: ChatMessage) => void;
  /** Replace the content array of a streaming message (text-only, real-time). */
  updateStreamingBlocks: (id: string, blocks: ContentBlock[]) => void;
  /** Replace content and mark streaming: false (called after history reload). */
  replaceMessageContent: (id: string, blocks: ContentBlock[]) => void;
  finalizeStreamingMessage: (id: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  setActiveAgent: (agentId: string | null) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  /** Select the skill/session to use for the next message. */
  selectSkill: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  activeSessionId: null,
  activeAgentId: null,
  sessions: [],
  error: null,

  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),

  updateStreamingBlocks: (id, blocks) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content: blocks } : m)),
    })),

  replaceMessageContent: (id, blocks) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: blocks, streaming: false } : m,
      ),
    })),

  finalizeStreamingMessage: (id) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
      isStreaming: false,
    })),

  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setActiveAgent: (activeAgentId) => set({ activeAgentId }),
  setSessions: (sessions) => set({ sessions }),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  selectSkill: (sessionId) => set({ activeSessionId: sessionId }),
}));
