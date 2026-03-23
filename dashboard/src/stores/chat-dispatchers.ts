/**
 * Pure event dispatcher functions for chat SSE events.
 *
 * Session-scoped: every mutation routes through a `sessionKey` so that
 * multiple concurrent sessions can stream independently.
 *
 * ContentBlock-native: messages store `ContentBlock[]` directly; no
 * intermediate text extraction for storage.
 *
 * All functions are pure with respect to React — no hooks are called here.
 * Side effects (store mutations) are performed through the ChatStoreAPI
 * interface, which matches the Zustand store's public API 1-to-1.
 */

import type {
  ApprovalRequest,
  A2UIEvent,
  ContentBlock,
  ChatMessage,
  RunMetadata,
} from "./chat-types";

// Re-export types for convenience
export type { ApprovalRequest, A2UIEvent, ContentBlock, ChatMessage };

// ---------------------------------------------------------------------------
// SSE payload types
// ---------------------------------------------------------------------------

/**
 * Gateway chat event payload shape (from ChatEventSchema):
 *   { runId, sessionKey, seq, state: "delta"|"final"|"error"|"aborted",
 *     message?: { role, content: ContentBlock[], timestamp },
 *     errorMessage?, stopReason? }
 */
export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "error" | "aborted";
  message?: {
    role: string;
    content: ContentBlock[];
    timestamp?: number;
  };
  errorMessage?: string;
  stopReason?: string;
};

/**
 * Agent event payload shape (from AgentEventPayload):
 *   { runId?, seq?, stream, ts?, data, sessionKey? }
 */
export type AgentEventPayload = {
  runId?: string;
  seq?: number;
  stream: string;
  ts?: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};

// ---------------------------------------------------------------------------
// Per-session streaming tracker — lightweight mutable state
// ---------------------------------------------------------------------------

export interface StreamingTracker {
  prevThinking: string;
  prevToolCount: number;
}

function createStreamingTracker(): StreamingTracker {
  return { prevThinking: "", prevToolCount: 0 };
}

/** Get or create a tracker for a given session. */
function getTracker(trackers: Map<string, StreamingTracker>, sessionKey: string): StreamingTracker {
  let t = trackers.get(sessionKey);
  if (!t) {
    t = createStreamingTracker();
    trackers.set(sessionKey, t);
  }
  return t;
}

function resetTracker(trackers: Map<string, StreamingTracker>, sessionKey: string): void {
  trackers.set(sessionKey, createStreamingTracker());
}

// ---------------------------------------------------------------------------
// ChatStoreAPI — decouples dispatcher logic from Zustand
// ---------------------------------------------------------------------------

export interface ChatStoreAPI {
  ensureSession: (key: string) => void;
  addMessage: (sessionKey: string, msg: ChatMessage) => void;
  updateStreamingContent: (sessionKey: string, msgId: string, content: ContentBlock[]) => void;
  appendContentBlock: (sessionKey: string, msgId: string, block: ContentBlock) => void;
  finalizeMessage: (sessionKey: string, msgId: string) => void;
  setSessionStreaming: (sessionKey: string, streaming: boolean) => void;
  /** Convenience: sets isStreaming + streamingRunId in one call. */
  setStreaming: (sessionKey: string, streaming: boolean, runId?: string) => void;
  setSessionError: (sessionKey: string, error: string | null) => void;
  setRunMetadata: (sessionKey: string, msgId: string, metadata: Partial<RunMetadata>) => void;
  setActiveApproval: (sessionKey: string, approval: ApprovalRequest | null) => void;
  appendA2UIEvent: (sessionKey: string, event: A2UIEvent) => void;
  updateA2UISurfaces: (sessionKey: string, surfaces: string[]) => void;
  setA2UIState: (sessionKey: string, patch: { visible?: boolean }) => void;
  setMessages: (sessionKey: string, messages: ChatMessage[]) => void;
  getSessionMessages: (sessionKey: string) => ChatMessage[];
  updateToolProgress: (
    sessionKey: string,
    toolUseId: string,
    progress: {
      toolUseId: string;
      name: string;
      status: "running" | "completed" | "error";
      startedAt: number;
      completedAt?: number;
    },
  ) => void;
}

// ---------------------------------------------------------------------------
// Default store + trackers — used when callers omit store/trackers args
// ---------------------------------------------------------------------------

/** Shared tracker map for convenience (no-args) dispatch calls. */
const defaultTrackers = new Map<string, StreamingTracker>();

/** Build a ChatStoreAPI from the Zustand store (lazy to avoid circular import). */
function getDefaultAPI(): ChatStoreAPI {
  // Dynamic import avoids circular dependency at parse time.
  // Safe because dispatchers only run after the store is initialized.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useChatStore } = require("./chat") as typeof import("./chat");
  const s = useChatStore.getState();
  return {
    ensureSession: s.ensureSession,
    addMessage: s.addMessage,
    updateStreamingContent: s.updateStreamingContent,
    appendContentBlock: s.appendContentBlock,
    finalizeMessage: s.finalizeMessage,
    setSessionStreaming: s.setSessionStreaming,
    setStreaming: s.setStreaming,
    setSessionError: s.setSessionError,
    setRunMetadata: s.setRunMetadata,
    setActiveApproval: s.setActiveApproval,
    appendA2UIEvent: s.appendA2UIEvent,
    updateA2UISurfaces: s.updateA2UISurfaces,
    setA2UIState: s.setA2UIState,
    setMessages: s.setMessages,
    getSessionMessages: (key) => useChatStore.getState().sessions.get(key)?.messages ?? [],
    updateToolProgress: s.updateToolProgress,
  };
}

// ---------------------------------------------------------------------------
// Helper functions — kept exported for other consumers
// ---------------------------------------------------------------------------

/**
 * Extract concatenated text from message content blocks.
 * Kept for backward compatibility; storage now uses ContentBlock[] directly.
 */
export function extractTextFromMessage(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "text" && "text" in block)
    .map((block) => block.text)
    .join("");
}

export function extractThinking(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "thinking" && "text" in block)
    .map((block) => block.text)
    .join("");
}

// ---------------------------------------------------------------------------
// dispatchChatEvent — handles SSE "chat" events
// ---------------------------------------------------------------------------

/**
 * Process a single `chat` SSE event and mutate the store accordingly.
 *
 * Session-scoped: routes by `payload.sessionKey`. Each session has its own
 * streaming state tracked in the `trackers` Map.
 *
 * ContentBlock-native: stores `payload.message.content` directly — no
 * intermediate text extraction for storage.
 *
 * When called without `store` / `trackers`, uses the default Zustand store.
 */
export function dispatchChatEvent(
  payload: ChatEventPayload,
  store?: ChatStoreAPI,
  trackers?: Map<string, StreamingTracker>,
): void {
  const api = store ?? getDefaultAPI();
  const trk = trackers ?? defaultTrackers;

  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  api.ensureSession(sessionKey);
  const tracker = getTracker(trk, sessionKey);

  if (payload.state === "delta") {
    const content = payload.message?.content ?? [];

    // Check if we already have a message for this runId in this session
    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === payload.runId);

    if (!existing) {
      // First delta for this runId — create the message
      api.setStreaming(sessionKey, true, payload.runId);
      tracker.prevThinking = "";
      tracker.prevToolCount = 0;
      api.addMessage(sessionKey, {
        id: payload.runId,
        role: "assistant",
        content,
        timestamp: payload.message?.timestamp ?? Date.now(),
        streaming: true,
      });
    } else {
      // Subsequent delta — update content blocks (gateway sends full accumulated content)
      api.updateStreamingContent(sessionKey, payload.runId, content);
    }
    return;
  }

  if (payload.state === "final") {
    const content = payload.message?.content ?? [];
    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === payload.runId);

    if (existing) {
      // Was streaming — update with final content and finalize
      if (content.length > 0) {
        api.updateStreamingContent(sessionKey, payload.runId, content);
      }
      api.finalizeMessage(sessionKey, payload.runId);
    } else if (content.length > 0 && payload.runId) {
      // Final without preceding delta (e.g., command response)
      api.addMessage(sessionKey, {
        id: payload.runId,
        role: "assistant",
        content,
        timestamp: payload.message?.timestamp ?? Date.now(),
      });
    }

    api.setSessionStreaming(sessionKey, false);
    resetTracker(trk, sessionKey);

    // Fire-and-forget reload of full content blocks from gateway history
    void reloadFullContent(sessionKey, payload.runId, api);
    return;
  }

  if (payload.state === "error") {
    api.setSessionError(sessionKey, payload.errorMessage ?? "Unknown error");
    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === payload.runId);
    if (existing) {
      api.finalizeMessage(sessionKey, payload.runId);
    }
    api.setSessionStreaming(sessionKey, false);
    resetTracker(trk, sessionKey);
    return;
  }

  if (payload.state === "aborted") {
    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === payload.runId);
    if (existing) {
      api.finalizeMessage(sessionKey, payload.runId);
    }
    api.setSessionStreaming(sessionKey, false);
    resetTracker(trk, sessionKey);
  }
}

// ---------------------------------------------------------------------------
// dispatchAgentEvent — handles SSE "agent" events
// ---------------------------------------------------------------------------

/**
 * Process a single `agent` SSE event and mutate the store accordingly.
 *
 * Agent tool events often arrive BEFORE the first chat delta for the same
 * runId, so we check for an existing message and create a placeholder if
 * needed.
 *
 * When called without `store` / `trackers`, uses the default Zustand store.
 */
export function dispatchAgentEvent(
  payload: AgentEventPayload,
  store?: ChatStoreAPI,
  trackers?: Map<string, StreamingTracker>,
): void {
  const api = store ?? getDefaultAPI();
  const trk = trackers ?? defaultTrackers;

  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  api.ensureSession(sessionKey);
  const agentRunId = payload.runId;

  // Tool call events: start → append block, result → append result block
  if (payload.stream === "tool") {
    const phase = payload.data.phase as string | undefined;
    const toolName = payload.data.name as string | undefined;
    const toolCallId = payload.data.toolCallId as string | undefined;

    if (!toolCallId) {
      return;
    }

    // Find the message to attach tool blocks to
    const existingMessages = api.getSessionMessages(sessionKey);
    // Prefer the message matching agentRunId, fall back to the currently streaming message
    let targetMsg = existingMessages.find((m) => m.id === agentRunId);
    if (!targetMsg) {
      targetMsg = existingMessages.find((m) => m.streaming);
    }

    if (!targetMsg && phase === "start" && agentRunId) {
      // Create placeholder — chat delta will update text later
      api.setStreaming(sessionKey, true, agentRunId);
      resetTracker(trk, sessionKey);
      api.addMessage(sessionKey, {
        id: agentRunId,
        role: "assistant",
        content: [],
        timestamp: payload.ts ?? Date.now(),
        streaming: true,
      });
    }

    const messageId = targetMsg?.id ?? agentRunId ?? "";

    if (phase === "start" && toolName) {
      api.appendContentBlock(sessionKey, messageId, {
        type: "tool_use",
        id: toolCallId,
        name: toolName,
        input: (payload.data.args as Record<string, unknown>) ?? {},
      });

      // Track tool progress
      api.updateToolProgress(sessionKey, toolCallId, {
        toolUseId: toolCallId,
        name: toolName,
        status: "running",
        startedAt: Date.now(),
      });
    } else if (phase === "result") {
      const result =
        typeof payload.data.result === "string"
          ? payload.data.result
          : JSON.stringify(payload.data.result ?? "");
      api.appendContentBlock(sessionKey, messageId, {
        type: "tool_result",
        toolUseId: toolCallId,
        content: result,
        isError: (payload.data.isError as boolean) ?? false,
      });

      // Update tool progress to completed
      api.updateToolProgress(sessionKey, toolCallId, {
        toolUseId: toolCallId,
        name: (payload.data.name as string) ?? "unknown",
        status: "completed",
        startedAt: 0,
        completedAt: Date.now(),
      });
    } else if (phase === "error") {
      api.updateToolProgress(sessionKey, toolCallId, {
        toolUseId: toolCallId,
        name: (payload.data.name as string) ?? "unknown",
        status: "error",
        startedAt: 0,
      });
    }
  }

  // Lifecycle events: capture run metadata (model, usage, duration).
  if (payload.stream === "lifecycle") {
    const phase = payload.data.phase as string | undefined;
    if (phase === "end" || phase === "error") {
      const model = payload.data.model as string | undefined;
      const _provider = payload.data.provider as string | undefined;
      const usage = payload.data.usage as
        | { input?: number; output?: number; cacheRead?: number }
        | undefined;
      const endedAt = payload.data.endedAt as number | undefined;
      const startedAt = payload.data.startedAt as number | undefined;
      if (model || usage) {
        const targetId = agentRunId ?? "";
        api.setRunMetadata(sessionKey, targetId, {
          model,
          usage: usage
            ? { input: usage.input, output: usage.output, cache: usage.cacheRead }
            : undefined,
          durationMs: endedAt && startedAt ? endedAt - startedAt : undefined,
          startedAt,
        });
      }
    }
  }

  // Thinking stream: append thinking block to the current message.
  if (payload.stream === "thinking") {
    const text = payload.data.text as string | undefined;
    if (!text) {
      return;
    }

    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === agentRunId);

    if (existing) {
      api.appendContentBlock(sessionKey, existing.id, {
        type: "thinking",
        text,
      });
    } else if (agentRunId) {
      // Thinking arrived before chat delta — create placeholder
      api.setStreaming(sessionKey, true, agentRunId);
      resetTracker(trk, sessionKey);
      api.addMessage(sessionKey, {
        id: agentRunId,
        role: "assistant",
        content: [{ type: "thinking", text }],
        timestamp: payload.ts ?? Date.now(),
        streaming: true,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Stub dispatchers — approval, A2UI, reload
// ---------------------------------------------------------------------------

/**
 * Dispatch an approval request to the correct session.
 * Payload shape: `{ sessionKey, id, toolName, command?, description? }`
 */
export function dispatchApproval(
  payload: { sessionKey: string } & ApprovalRequest,
  store?: ChatStoreAPI,
): void {
  const api = store ?? getDefaultAPI();
  const { sessionKey, ...approval } = payload;
  api.setActiveApproval(sessionKey, approval);
}

/**
 * Clear the active approval for a session.
 */
export function dispatchApprovalResolved(
  payload: { sessionKey: string },
  store?: ChatStoreAPI,
): void {
  const api = store ?? getDefaultAPI();
  api.setActiveApproval(payload.sessionKey, null);
}

/**
 * Dispatch an A2UI (Agent-to-User Interface) event to the correct session.
 */
export function dispatchA2UIEvent(
  payload: {
    sessionKey: string;
    surfaceUpdate?: { surfaceId: string; components: unknown[] };
    event?: A2UIEvent;
    surfaces?: string[];
  },
  store?: ChatStoreAPI,
): void {
  const api = store ?? getDefaultAPI();
  const { sessionKey } = payload;

  // If there's a surface update, auto-show the A2UI overlay and append an event
  if (payload.surfaceUpdate) {
    api.setA2UIState(sessionKey, { visible: true });
    api.appendA2UIEvent(sessionKey, {
      timestamp: Date.now(),
      direction: "inbound",
      action: "surfaceUpdate",
      summary: `Surface ${payload.surfaceUpdate.surfaceId} updated`,
      raw: payload.surfaceUpdate,
    });
  }

  // If there's an explicit event, append it
  if (payload.event) {
    api.appendA2UIEvent(sessionKey, payload.event);
  }

  if (payload.surfaces) {
    api.updateA2UISurfaces(sessionKey, payload.surfaces);
  }
}

/**
 * Fetch full message content from the gateway history API and replace
 * the streaming-collected content with the authoritative server version.
 *
 * Retries once on failure. If both attempts fail, the original content
 * is preserved.
 */
export async function reloadFullContent(
  sessionKey: string,
  runId: string,
  store?: ChatStoreAPI,
): Promise<void> {
  const api = store ?? getDefaultAPI();
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `/api/deck/chat/history?sessionKey=${encodeURIComponent(sessionKey)}&limit=5`,
      );
      if (!res.ok) {
        continue;
      }

      const data = (await res.json()) as {
        messages?: Array<{
          role: string;
          content: ContentBlock[];
        }>;
      };

      if (!data.messages) {
        return;
      }

      // Find the last assistant message in the response
      const assistantMsg = [...data.messages].toReversed().find((m) => m.role === "assistant");
      if (!assistantMsg) {
        return;
      }

      // Map content blocks (normalize tool_result toolUseId)
      const blocks: ContentBlock[] = assistantMsg.content.map((block) => {
        // Handle snake_case tool_use_id → camelCase toolUseId
        const raw = block as Record<string, unknown>;
        if (raw.type === "tool_result" && raw.tool_use_id && !raw.toolUseId) {
          return {
            type: "tool_result" as const,
            toolUseId: raw.tool_use_id as string,
            content: (raw.content as string) ?? "",
            isError: (raw.isError as boolean) ?? false,
          };
        }
        return block;
      });

      // Replace message content — re-read messages to handle concurrent updates
      const messages = api.getSessionMessages(sessionKey);
      const msgIdx = messages.findIndex((m) => m.id === runId);
      if (msgIdx === -1) {
        return; // Session or message was removed during fetch
      }

      const updated = [...messages];
      updated[msgIdx] = { ...updated[msgIdx], content: blocks };
      api.setMessages(sessionKey, updated);
      return;
    } catch {
      // Retry on next iteration
    }
  }
  // Both retries failed — keep original content
}
