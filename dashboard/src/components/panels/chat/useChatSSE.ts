"use client";

import { useEffect } from "react";
import { useChatStore, type ContentBlock, type ApprovalRequest } from "@/stores/chat";
import { getSessionAbort } from "@/stores/chat-abort";

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

/**
 * Gateway chat event payload shape (from ChatEventSchema):
 *   { runId, sessionKey, seq, state: "delta"|"final"|"error"|"aborted",
 *     message?: { role, content: [{type:"text",text}], timestamp },
 *     errorMessage?, stopReason? }
 *
 * IMPORTANT: The discriminant field is `state`, NOT `type`.
 */
export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "error" | "aborted";
  message?: {
    role: string;
    content: Array<{ type: string; text?: string }>;
    timestamp?: number;
  };
  errorMessage?: string;
  stopReason?: string;
};

export type AgentEventPayload = {
  sessionKey: string;
  stream?: string;
  data?: {
    phase?: string;
    name?: string;
    toolCallId?: string;
    args?: Record<string, unknown>;
  };
};

export type ApprovalEventPayload = {
  sessionKey: string;
  id?: string;
  toolName?: string;
  command?: string;
  description?: string;
};

export type ApprovalResolvedPayload = {
  sessionKey: string;
};

export type A2UIEventPayload = {
  sessionKey: string;
  url?: string;
  visible?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers (kept from original — correct and well-tested)
// ---------------------------------------------------------------------------

/**
 * Extract concatenated text from the message's content blocks.
 *
 * IMPORTANT: The payload has no top-level `text` field. Text must be
 * extracted from `payload.message.content` blocks of type "text".
 */
export function extractTextFromMessage(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("");
}

/** Map a raw Gateway/Anthropic block to a typed ContentBlock. */
export function mapBlock(block: Record<string, unknown>): ContentBlock {
  const type = ((block.type as string) ?? "text").toLowerCase();
  if (type === "text") {
    return { type: "text", text: (block.text as string) ?? "" };
  }
  if (type === "image") {
    const source = block.source as Record<string, unknown> | undefined;
    return {
      type: "image",
      data: (source?.data as string) ?? "",
      mimeType: (source?.media_type as string) ?? "",
    };
  }
  if (["tool_use", "toolcall", "tool_call"].includes(type)) {
    return {
      type: "tool_use",
      id: (block.id as string) ?? "",
      name: (block.name as string) ?? "",
      input: (block.input ?? block.arguments ?? {}) as Record<string, unknown>,
    };
  }
  if (["tool_result", "tool_result_error"].includes(type)) {
    return {
      type: "tool_result",
      toolUseId: ((block.tool_use_id ?? block.toolUseId) as string) ?? "",
      content: ((block.content ?? block.output) as string) ?? "",
      isError: block.is_error === true || type === "tool_result_error",
    };
  }
  if (type === "thinking") {
    return { type: "thinking", text: ((block.thinking ?? block.text) as string) ?? "" };
  }
  // Unknown block type — serialise as text to avoid silent data loss
  return { type: "text", text: JSON.stringify(block) };
}

// ---------------------------------------------------------------------------
// Standalone dispatcher functions (NOT hooks — use getState() directly)
// ---------------------------------------------------------------------------

/**
 * Dispatch a chat SSE event to the correct session in the store.
 *
 * KEY CHANGES from the old closure-based approach:
 * - Routes ALL events to their correct session via `payload.sessionKey`
 *   (no filtering by activeSessionId — enables background session tracking)
 * - Reads `session.streamingRunId` from the store instead of a React ref
 * - Uses session-scoped store actions (sessionKey as first argument)
 */
export function dispatchChatEvent(payload: ChatEventPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  const store = useChatStore.getState();
  store.ensureSession(sessionKey);

  switch (payload.state) {
    case "delta": {
      const text = extractTextFromMessage(payload.message);
      // Read the current session to determine first-delta vs subsequent-delta
      const session = useChatStore.getState().sessions.get(sessionKey);
      if (session && session.streamingRunId !== payload.runId) {
        // First delta for this run — add new streaming message
        useChatStore.getState().setStreaming(sessionKey, true, payload.runId);
        useChatStore.getState().addMessage(sessionKey, {
          id: payload.runId,
          role: "assistant",
          content: [{ type: "text", text }],
          timestamp: payload.message?.timestamp ?? Date.now(),
          streaming: true,
        });
      } else {
        // Subsequent delta — Gateway sends full accumulated text, not incremental
        useChatStore
          .getState()
          .updateStreamingBlocks(sessionKey, payload.runId, [{ type: "text", text }]);
      }
      break;
    }

    case "final": {
      const text = extractTextFromMessage(payload.message);
      const session = useChatStore.getState().sessions.get(sessionKey);
      const streamingRunId = session?.streamingRunId;

      if (streamingRunId && streamingRunId === payload.runId) {
        // Normal final after streaming deltas
        if (text) {
          useChatStore
            .getState()
            .updateStreamingBlocks(sessionKey, streamingRunId, [{ type: "text", text }]);
        }
        useChatStore.getState().finalizeStreamingMessage(sessionKey, streamingRunId);
        useChatStore.getState().setStreaming(sessionKey, false);

        // Reload full content blocks (tool_use, tool_result, thinking, image)
        void reloadFullContent(sessionKey, streamingRunId);
      } else if (text && payload.runId) {
        // Final without preceding delta (e.g., command response)
        useChatStore.getState().addMessage(sessionKey, {
          id: payload.runId,
          role: "assistant",
          content: [{ type: "text", text }],
          timestamp: payload.message?.timestamp ?? Date.now(),
        });
        useChatStore.getState().setStreaming(sessionKey, false);

        // Also reload for standalone finals
        void reloadFullContent(sessionKey, payload.runId);
      } else {
        useChatStore.getState().setStreaming(sessionKey, false);
      }
      break;
    }

    case "error": {
      // IMPORTANT: error text is in `payload.errorMessage`, NOT `payload.message`
      useChatStore.getState().setError(sessionKey, payload.errorMessage ?? "Unknown error");

      const session = useChatStore.getState().sessions.get(sessionKey);
      if (session?.streamingRunId) {
        useChatStore.getState().finalizeStreamingMessage(sessionKey, session.streamingRunId);
      }
      useChatStore.getState().setStreaming(sessionKey, false);
      break;
    }

    case "aborted": {
      const session = useChatStore.getState().sessions.get(sessionKey);
      if (session?.streamingRunId) {
        useChatStore.getState().finalizeStreamingMessage(sessionKey, session.streamingRunId);
      }
      useChatStore.getState().setStreaming(sessionKey, false);
      break;
    }
  }
}

/**
 * Dispatch an agent tool-execution event to the correct session.
 *
 * Gateway emits: { sessionKey, stream: "tool", data: { phase, name, toolCallId, args } }
 * Only handles `phase === "start"` to avoid duplicate blocks from update/result phases.
 */
export function dispatchAgentEvent(payload: AgentEventPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  try {
    const stream = payload.stream;
    const data = payload.data;
    if (stream !== "tool" || !data) {
      return;
    }

    // Only create a block on the start phase; update/result phases would duplicate it
    if (data.phase !== "start") {
      return;
    }

    const toolName = data.name;
    if (!toolName) {
      return;
    }

    // Single getState() read for both streamingRunId and message lookup
    const sess = useChatStore.getState().sessions.get(sessionKey);
    const streamingRunId = sess?.streamingRunId;
    if (!streamingRunId || !sess) {
      return;
    }

    const block: ContentBlock = {
      type: "tool_use",
      // Gateway uses toolCallId (not id) and args (not input)
      id: data.toolCallId ?? `tool-${Date.now()}`,
      name: toolName,
      input: data.args ?? {},
    };

    // Append the tool_use block alongside any existing text blocks.
    // Use updateStreamingBlocks (via store action) to update the session Map immutably.
    const msg = sess.messages.find((m) => m.id === streamingRunId);
    if (!msg) {
      return;
    }
    useChatStore
      .getState()
      .updateStreamingBlocks(sessionKey, streamingRunId, [...msg.content, block]);
  } catch {
    // Ignore malformed payloads
  }
}

/**
 * Dispatch a tool approval request to the correct session.
 *
 * Gateway broadcasts this as "approval.pending".
 */
export function dispatchApproval(payload: ApprovalEventPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  try {
    const approval: ApprovalRequest = {
      id: payload.id ?? "",
      toolName: payload.toolName ?? payload.command ?? "unknown",
      command: payload.command,
      description: payload.description,
    };
    if (approval.id) {
      useChatStore.getState().ensureSession(sessionKey);
      useChatStore.getState().setActiveApproval(sessionKey, approval);
    }
  } catch {
    // Ignore malformed payloads
  }
}

/**
 * Clear active approval for a session when approval is resolved.
 *
 * Gateway broadcasts this as "approval.resolved".
 */
export function dispatchApprovalResolved(payload: ApprovalResolvedPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  // Don't recreate an evicted session just to clear its approval
  if (!useChatStore.getState().sessions.has(sessionKey)) {
    return;
  }
  useChatStore.getState().setActiveApproval(sessionKey, null);
}

/**
 * Dispatch an A2UI (Agent-to-User Interface) event to the correct session.
 */
export function dispatchA2UIEvent(payload: A2UIEventPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  useChatStore.getState().ensureSession(sessionKey);
  useChatStore.getState().setA2UIState(sessionKey, {
    url: payload.url ?? "",
    visible: payload.visible ?? false,
  });
}

// ---------------------------------------------------------------------------
// reloadFullContent — session-scoped version of the old reloadLastMessage
// ---------------------------------------------------------------------------

/**
 * Reload the last assistant message from chat.history to get full content
 * blocks (tool_use, tool_result, thinking, image). Called after the `final`
 * SSE event so that the in-memory message reflects what the Gateway persisted.
 *
 * Uses `getSessionAbort(sessionKey).signal` so the fetch can be cancelled
 * when the session is removed or aborted.
 *
 * Retry policy: try twice with a 1 s delay. On failure, keep existing text.
 * Queries `limit=5` because the last message may be a user message — we need
 * to scan back to find the assistant message to replace.
 */
export async function reloadFullContent(sessionKey: string, messageId: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const signal = getSessionAbort(sessionKey).signal;
      const params = new URLSearchParams({ sessionKey, limit: "5" });
      const res = await fetch(`/api/chat/history?${params}`, { signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { messages?: Array<Record<string, unknown>> };
      const messages = Array.isArray(data) ? data : (data.messages ?? []);
      // Find the last assistant message
      const lastAssistant = [...messages].toReversed().find((m) => m.role === "assistant");

      // Double-check session still exists before mutating
      if (!useChatStore.getState().sessions.has(sessionKey)) {
        return;
      }

      if (lastAssistant && Array.isArray(lastAssistant.content)) {
        const blocks = (lastAssistant.content as Record<string, unknown>[]).map(mapBlock);
        useChatStore.getState().replaceMessageContent(sessionKey, messageId, blocks);
      }
      return;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  // Both attempts failed — keep the streaming text, don't lose content
}

// ---------------------------------------------------------------------------
// useSSEConnection hook — the only React hook in this module
// ---------------------------------------------------------------------------

/**
 * Connect to the SSE stream and dispatch events to session-scoped store.
 *
 * Empty deps array: the connection survives session switches because all
 * routing is done by `payload.sessionKey` inside the dispatcher functions.
 * No closure over `activeSessionId` means no EventSource reconnection on
 * session switch.
 *
 * Reconnection: The native EventSource API automatically reconnects with
 * ~3 s delay. The server supports `Last-Event-ID` replay, so no events
 * are lost during brief disconnections.
 */
export function useSSEConnection(): void {
  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.addEventListener("chat", (e) => {
      dispatchChatEvent(JSON.parse(e.data) as ChatEventPayload);
    });

    es.addEventListener("agent", (e) => {
      dispatchAgentEvent(JSON.parse(e.data) as AgentEventPayload);
    });

    es.addEventListener("approval.pending", (e) => {
      dispatchApproval(JSON.parse(e.data) as ApprovalEventPayload);
    });

    es.addEventListener("approval.resolved", (e) => {
      const payload = JSON.parse(e.data) as ApprovalResolvedPayload;
      dispatchApprovalResolved(payload);
    });

    es.addEventListener("a2ui", (e) => {
      dispatchA2UIEvent(JSON.parse(e.data) as A2UIEventPayload);
    });

    return () => es.close();
  }, []); // ← empty deps: survives session switches
}

/**
 * @deprecated Use `useSSEConnection` instead. Kept for backward compatibility
 * during migration (Task 5 will update all consumers).
 */
export function useChatSSE(): void {
  useSSEConnection();
}
