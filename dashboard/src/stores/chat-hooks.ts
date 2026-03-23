// ---------------------------------------------------------------------------
// Session-scoped selector hooks for the Zustand chat store.
//
// All hooks read from the Map<string, SessionState> in ChatState.
// When sessionKey is omitted, the active session is used.
// ---------------------------------------------------------------------------

import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "./chat";
import type {
  ChatMessage,
  ToolProgress,
  ApprovalRequest,
  A2UIState,
  A2UIEvent,
  SessionMeta,
} from "./chat-types";

// Re-export types for consumers
export type { ToolProgress, ApprovalRequest, A2UIState, A2UIEvent, SessionMeta };

// hooks-specific composite type
export type SessionIndicator = "approval" | "streaming" | "canvas" | "idle" | "none";

// Stable default references to avoid infinite re-render loops in Zustand selectors
const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_TOOL_PROGRESS: Record<string, ToolProgress> = {};
const EMPTY_EVENTS: A2UIEvent[] = [];
const EMPTY_METAS: SessionMeta[] = [];

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Subscribe to messages for a session (defaults to active session). */
export function useSessionMessages(sessionKey?: string): ChatMessage[] {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.messages ?? EMPTY_MESSAGES) : EMPTY_MESSAGES;
  });
}

// ---------------------------------------------------------------------------
// Streaming state
// ---------------------------------------------------------------------------

/** Subscribe to streaming status for a session (defaults to active session). */
export function useSessionStreaming(sessionKey?: string): {
  isStreaming: boolean;
  runId: string | null;
} {
  return useChatStore(
    useShallow((s) => {
      const key = sessionKey ?? s.activeSessionKey;
      const session = key ? s.sessions.get(key) : undefined;
      return {
        isStreaming: session?.isStreaming ?? false,
        runId: session?.streamingRunId ?? null,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Tool progress
// ---------------------------------------------------------------------------

/** Subscribe to tool progress for a session (defaults to active session). */
export function useSessionToolProgress(sessionKey?: string): Record<string, ToolProgress> {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.toolProgress ?? EMPTY_TOOL_PROGRESS) : EMPTY_TOOL_PROGRESS;
  });
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

/** Subscribe to the active approval request for a session (defaults to active session). */
export function useSessionApproval(sessionKey?: string): ApprovalRequest | null {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.activeApproval ?? null) : null;
  });
}

// ---------------------------------------------------------------------------
// Active session key
// ---------------------------------------------------------------------------

/** Subscribe to the globally active session key. */
export function useActiveSessionKey(): string | null {
  return useChatStore((s) => s.activeSessionKey);
}

// ---------------------------------------------------------------------------
// Session error
// ---------------------------------------------------------------------------

/** Subscribe to the error for a session (defaults to active session). */
export function useSessionError(sessionKey?: string): string | null {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.error ?? null) : null;
  });
}

// ---------------------------------------------------------------------------
// Session indicator (composite selector)
// ---------------------------------------------------------------------------

/**
 * Derive a single status indicator for a session.
 * Priority: approval > streaming > canvas > idle > none.
 */
export function useSessionIndicator(key: string): SessionIndicator {
  return useChatStore((s) => {
    const session = s.sessions.get(key);
    if (!session) {
      return "none";
    }
    if (session.activeApproval != null) {
      return "approval";
    }
    if (session.isStreaming) {
      return "streaming";
    }
    if (session.a2uiState?.visible) {
      return "canvas";
    }
    return session.messages.length > 0 ? "idle" : "none";
  });
}

// ---------------------------------------------------------------------------
// A2UI Canvas state
// ---------------------------------------------------------------------------

/** Subscribe to A2UI overlay state for a session (defaults to active session). */
export function useSessionA2UI(sessionKey?: string): A2UIState | null {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.a2uiState ?? null) : null;
  });
}

/** Subscribe to A2UI event log for a session (defaults to active session). */
export function useSessionA2UIEvents(sessionKey?: string): A2UIEvent[] {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.a2uiState?.eventLog ?? EMPTY_EVENTS) : EMPTY_EVENTS;
  });
}

/** Subscribe to A2UI bridge status for a session (defaults to active session). */
export function useSessionA2UIBridgeStatus(
  sessionKey?: string,
): "connecting" | "ready" | "error" | undefined {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? s.sessions.get(key)?.a2uiState?.bridgeStatus : undefined;
  });
}

// ---------------------------------------------------------------------------
// Session metadata list
// ---------------------------------------------------------------------------

/** Subscribe to the full list of session metadata. */
export function useSessionMetaList(): SessionMeta[] {
  return useChatStore((s) => s.sessionMetas ?? EMPTY_METAS);
}
