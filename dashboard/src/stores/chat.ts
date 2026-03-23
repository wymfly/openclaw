import { create } from "zustand";

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type ToolUseBlock = {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  toolCallId?: string;
  isError?: boolean;
  status?: "running" | "completed" | "error";
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** Tool invocations attached to this message (assistant only). */
  toolUse?: ToolUseBlock[];
  /** Extended thinking trace (assistant only). */
  thinking?: string;
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
  updateStreamingMessage: (id: string, content: string) => void;
  finalizeStreamingMessage: (id: string) => void;
  appendThinking: (id: string, text: string) => void;
  appendToolUse: (id: string, tool: ToolUseBlock) => void;
  updateToolUseResult: (
    messageId: string,
    toolCallId: string,
    result: string,
    isError?: boolean,
  ) => void;
  setActiveSession: (sessionId: string | null) => void;
  setActiveAgent: (agentId: string | null) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  activeSessionId: null,
  activeAgentId: null,
  sessions: [],
  error: null,

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  updateStreamingMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),

  finalizeStreamingMessage: (id) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
      isStreaming: false,
    })),

  appendThinking: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, thinking: (m.thinking ?? "") + text } : m,
      ),
    })),

  appendToolUse: (id, tool) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== id) {
          return m;
        }
        // Deduplicate by toolCallId (events may arrive twice via targeted + global broadcast)
        if (tool.toolCallId && m.toolUse?.some((t) => t.toolCallId === tool.toolCallId)) {
          return m;
        }
        return { ...m, toolUse: [...(m.toolUse ?? []), tool] };
      }),
    })),

  updateToolUseResult: (messageId, toolCallId, result, isError) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId || !m.toolUse?.length) {
          return m;
        }
        return {
          ...m,
          toolUse: m.toolUse.map((t) =>
            t.toolCallId === toolCallId
              ? { ...t, result, isError, status: isError ? "error" : "completed" }
              : t,
          ),
        };
      }),
    })),

  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setActiveAgent: (activeAgentId) => set({ activeAgentId }),
  setSessions: (sessions) => set({ sessions }),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
}));
