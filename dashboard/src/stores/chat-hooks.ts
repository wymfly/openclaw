// ---------------------------------------------------------------------------
// Session-scoped selector hooks for the refactored Zustand chat store.
//
// Each hook subscribes to a specific slice of a specific session, preventing
// cross-session re-renders. All hooks accept an optional `sessionKey`; when
// omitted they fall back to `activeSessionKey`.
// ---------------------------------------------------------------------------

import { useShallow } from "zustand/shallow";
import { useChatStore } from "./chat";
import type {
  ChatMessage,
  ToolProgress,
  ApprovalRequest,
  A2UIState,
  SessionMeta,
} from "./chat-types";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Subscribe to messages for a single session. */
export function useSessionMessages(sessionKey?: string): ChatMessage[] {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.messages ?? []) : [];
  });
}

// ---------------------------------------------------------------------------
// Streaming state
// ---------------------------------------------------------------------------

/** Subscribe to streaming status and run ID for a single session. */
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

/** Subscribe to tool progress for a single session. */
export function useSessionToolProgress(sessionKey?: string): Record<string, ToolProgress> {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.toolProgress ?? {}) : {};
  });
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

/** Subscribe to the active approval request for a single session. */
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
// Session meta list
// ---------------------------------------------------------------------------

/** Subscribe to the session metadata list. */
export function useSessionMetaList(): SessionMeta[] {
  return useChatStore((s) => s.sessionMeta);
}

// ---------------------------------------------------------------------------
// Session error
// ---------------------------------------------------------------------------

/** Subscribe to the error for a single session. */
export function useSessionError(sessionKey?: string): string | null {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.error ?? null) : null;
  });
}

// ---------------------------------------------------------------------------
// A2UI state
// ---------------------------------------------------------------------------

/** Subscribe to A2UI overlay state for a single session. */
export function useSessionA2UI(sessionKey?: string): A2UIState | null {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.a2uiState ?? null) : null;
  });
}

// ---------------------------------------------------------------------------
// Session indicator (composite selector)
// ---------------------------------------------------------------------------

export type SessionIndicator = "approval" | "streaming" | "canvas" | "idle" | "none";

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
    if (session.activeApproval) {
      return "approval";
    }
    if (session.isStreaming) {
      return "streaming";
    }
    if (session.a2uiState) {
      return "canvas";
    }
    return "idle";
  });
}
