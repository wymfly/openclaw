// ---------------------------------------------------------------------------
// Session-scoped chat types for the refactored Zustand store.
//
// These are extracted from chat.ts (ContentBlock, ChatMessage, SessionInfo,
// ActiveApproval) plus new types for per-session state management.
// The original chat.ts remains untouched — consumers can import from either
// module during the migration period.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Content block types (Anthropic-compatible discriminated union)
// Re-exported so downstream can import from a single module.
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

// ---------------------------------------------------------------------------
// Legacy session info — kept for backward compatibility during migration.
// Will be replaced by SessionMeta.
// ---------------------------------------------------------------------------

export type SessionInfo = {
  key: string;
  sessionId?: string;
  agentId?: string;
  title?: string;
  lastMessage?: string;
  updatedAt?: number;
};

// ---------------------------------------------------------------------------
// Approval request (renamed from ActiveApproval for the new API)
// ---------------------------------------------------------------------------

export type ApprovalRequest = {
  id: string;
  toolName: string;
  command?: string;
  description?: string;
};

/** @deprecated Use ApprovalRequest — kept for migration compatibility. */
export type ActiveApproval = ApprovalRequest;

// ---------------------------------------------------------------------------
// Tool progress tracking
// ---------------------------------------------------------------------------

export interface ToolProgress {
  toolUseId: string;
  name: string;
  status: "running" | "completed" | "error";
  startedAt: number;
  completedAt?: number;
}

// ---------------------------------------------------------------------------
// A2UI state (Agent-to-User Interface overlay)
// ---------------------------------------------------------------------------

export interface A2UIState {
  /** Bundle URL or inline HTML to render. */
  url: string;
  /** Whether the A2UI overlay is currently visible. */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Per-session state
// ---------------------------------------------------------------------------

export interface SessionState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingRunId: string | null;
  error: string | null;
  toolProgress: Record<string, ToolProgress>;
  activeApproval: ApprovalRequest | null;
  a2uiState: A2UIState | null;
  status: "active" | "idle";
  lastAccessedAt: number;
}

// ---------------------------------------------------------------------------
// Session metadata (lightweight, always in memory)
// ---------------------------------------------------------------------------

export interface SessionMeta {
  key: string;
  agentId: string;
  title?: string;
  updatedAt: number;
  lastMessagePreview?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of session states kept in memory before LRU eviction. */
export const MAX_CACHED_SESSIONS = 20;

/** How long (ms) an idle session can stay cached before becoming evictable. */
export const DEFAULT_EVICT_IDLE_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a fresh, empty session state. */
export function createEmptySessionState(): SessionState {
  return {
    messages: [],
    isStreaming: false,
    streamingRunId: null,
    error: null,
    toolProgress: {},
    activeApproval: null,
    a2uiState: null,
    status: "idle",
    lastAccessedAt: Date.now(),
  };
}
