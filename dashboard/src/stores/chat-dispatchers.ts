/**
 * Pure event dispatcher functions for chat SSE events.
 *
 * Extracted from useChatSSE.ts so that the event-processing logic can be
 * tested independently of React hooks / Zustand internals.
 *
 * All functions are pure with respect to React — no hooks are called here.
 * Side effects (store mutations) are performed through the ChatStoreAPI
 * interface, which matches the Zustand store's public API 1-to-1.
 */

import type { ChatMessage, ToolUseBlock } from "./chat";

// ---------------------------------------------------------------------------
// SSE payload types (mirrors useChatSSE.ts)
// ---------------------------------------------------------------------------

/**
 * Gateway chat event payload shape (from ChatEventSchema):
 *   { runId, sessionKey, seq, state: "delta"|"final"|"error"|"aborted",
 *     message?: { role, content: ContentBlock[], timestamp },
 *     errorMessage?, stopReason? }
 */
type ContentBlock = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  toolUseId?: string;
  content?: string;
  isError?: boolean;
};

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
 *   { runId, seq, stream: "lifecycle"|"tool"|"assistant"|"error",
 *     ts, data: Record<string, unknown>, sessionKey? }
 */
export type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};

// ---------------------------------------------------------------------------
// Dispatcher context — mutable refs shared across event handlers
// ---------------------------------------------------------------------------

export interface DispatcherContext {
  /** runId of the message currently being streamed, or null. */
  streamingRunId: string | null;
  /** Accumulated thinking text for the current streaming message. */
  prevThinking: string;
  /** Number of tool-use blocks already appended for the current streaming message. */
  prevToolCount: number;
}

export function createDispatcherContext(): DispatcherContext {
  return {
    streamingRunId: null,
    prevThinking: "",
    prevToolCount: 0,
  };
}

// ---------------------------------------------------------------------------
// ChatStoreAPI — decouples dispatcher logic from Zustand
// ---------------------------------------------------------------------------

export interface ChatStoreAPI {
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
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  /** Read current messages (used to detect pre-existing messages by runId). */
  getMessages: () => ChatMessage[];
  /** Set run metadata on a message. */
  setRunMetadata: (messageId: string, metadata: ChatMessage["runMetadata"]) => void;
}

// ---------------------------------------------------------------------------
// Helper functions (exact copies from useChatSSE.ts)
// ---------------------------------------------------------------------------

export function extractTextFromMessage(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("");
}

export function extractThinking(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "thinking" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("");
}

type ToolUseInfo = { name: string; input: Record<string, unknown>; result?: string };

export function extractToolUse(message?: ChatEventPayload["message"]): ToolUseInfo[] {
  if (!message?.content) {
    return [];
  }
  const tools: ToolUseInfo[] = [];
  const toolResults = new Map<string, string>();

  // Collect tool results first
  for (const block of message.content) {
    if (block.type === "tool_result" && block.toolUseId) {
      toolResults.set(block.toolUseId, typeof block.content === "string" ? block.content : "");
    }
  }

  // Collect tool_use blocks and attach results
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name) {
      tools.push({
        name: block.name,
        input: block.input ?? {},
        result: block.id ? toolResults.get(block.id) : undefined,
      });
    }
  }

  return tools;
}

// ---------------------------------------------------------------------------
// dispatchChatEvent — handles SSE "chat" events (lines 129-237 of useChatSSE.ts)
// ---------------------------------------------------------------------------

/**
 * Process a single `chat` SSE event and mutate the store accordingly.
 *
 * The ctx object carries mutable streaming state (runId, thinking cursor,
 * tool count) across calls — callers must pass the same ctx instance for the
 * lifetime of a connection.
 */
export function dispatchChatEvent(
  payload: ChatEventPayload,
  store: ChatStoreAPI,
  ctx: DispatcherContext,
): void {
  if (payload.state === "delta") {
    const text = extractTextFromMessage(payload.message);
    if (!ctx.streamingRunId && payload.runId) {
      ctx.streamingRunId = payload.runId;
      ctx.prevThinking = "";
      ctx.prevToolCount = 0;
      store.setIsStreaming(true);
      store.addMessage({
        id: payload.runId,
        role: "assistant",
        content: text,
        timestamp: payload.message?.timestamp ?? Date.now(),
        streaming: true,
      });
    } else if (ctx.streamingRunId) {
      // Gateway sends the full accumulated text each delta, not incremental.
      store.updateStreamingMessage(ctx.streamingRunId, text);
    }

    // Extract and append thinking traces (incremental diff)
    if (ctx.streamingRunId) {
      const thinking = extractThinking(payload.message);
      if (thinking && thinking !== ctx.prevThinking) {
        const newPart = thinking.slice(ctx.prevThinking.length);
        if (newPart) {
          store.appendThinking(ctx.streamingRunId, newPart);
        }
        ctx.prevThinking = thinking;
      }

      // Extract tool_use blocks (append only new ones)
      const tools = extractToolUse(payload.message);
      if (tools.length > ctx.prevToolCount) {
        for (let i = ctx.prevToolCount; i < tools.length; i++) {
          store.appendToolUse(ctx.streamingRunId, tools[i]);
        }
        ctx.prevToolCount = tools.length;
      }
    }
    return;
  }

  if (payload.state === "final") {
    const text = extractTextFromMessage(payload.message);
    if (ctx.streamingRunId) {
      if (text) {
        store.updateStreamingMessage(ctx.streamingRunId, text);
      }

      // Final thinking/tool_use extraction
      const thinking = extractThinking(payload.message);
      if (thinking && thinking !== ctx.prevThinking) {
        const newPart = thinking.slice(ctx.prevThinking.length);
        if (newPart) {
          store.appendThinking(ctx.streamingRunId, newPart);
        }
      }
      const tools = extractToolUse(payload.message);
      if (tools.length > ctx.prevToolCount) {
        for (let i = ctx.prevToolCount; i < tools.length; i++) {
          store.appendToolUse(ctx.streamingRunId, tools[i]);
        }
      }

      store.finalizeStreamingMessage(ctx.streamingRunId);
      ctx.streamingRunId = null;
      ctx.prevThinking = "";
      ctx.prevToolCount = 0;
    } else if (text && payload.runId) {
      // Final without any preceding delta (e.g., command response)
      const thinking = extractThinking(payload.message);
      const tools = extractToolUse(payload.message);
      store.addMessage({
        id: payload.runId,
        role: "assistant",
        content: text,
        timestamp: payload.message?.timestamp ?? Date.now(),
        thinking: thinking || undefined,
        toolUse: tools.length > 0 ? tools : undefined,
      });
    }
    store.setIsStreaming(false);
    return;
  }

  if (payload.state === "error") {
    store.setError(payload.errorMessage ?? "Unknown error");
    if (ctx.streamingRunId) {
      store.finalizeStreamingMessage(ctx.streamingRunId);
      ctx.streamingRunId = null;
      ctx.prevThinking = "";
      ctx.prevToolCount = 0;
    }
    store.setIsStreaming(false);
    return;
  }

  if (payload.state === "aborted") {
    if (ctx.streamingRunId) {
      store.finalizeStreamingMessage(ctx.streamingRunId);
      ctx.streamingRunId = null;
      ctx.prevThinking = "";
      ctx.prevToolCount = 0;
    }
    store.setIsStreaming(false);
  }
}

// ---------------------------------------------------------------------------
// dispatchAgentEvent — handles SSE "agent" events (lines 246-348 of useChatSSE.ts)
// ---------------------------------------------------------------------------

/**
 * Process a single `agent` SSE event and mutate the store accordingly.
 *
 * Agent tool events often arrive BEFORE the first chat delta for the same
 * runId, so we cannot rely on ctx.streamingRunId alone.  Instead, we use the
 * agent event's own runId to find or create the message.
 */
export function dispatchAgentEvent(
  payload: AgentEventPayload,
  store: ChatStoreAPI,
  ctx: DispatcherContext,
): void {
  const agentRunId = payload.runId;
  if (!agentRunId) {
    return;
  }

  // Tool call events: start → append card, result → update with output
  if (payload.stream === "tool") {
    const phase = payload.data.phase as string | undefined;
    const toolName = payload.data.name as string | undefined;
    const toolCallId = payload.data.toolCallId as string | undefined;

    // Ensure a message exists for this runId (tool events may arrive before chat delta)
    let messageId = ctx.streamingRunId;
    if (messageId !== agentRunId) {
      // Check if a message with this runId already exists in the store
      const existing = store.getMessages().find((m) => m.id === agentRunId);
      if (!existing && phase === "start") {
        // Create a placeholder message — chat delta will update the text later
        ctx.streamingRunId = agentRunId;
        ctx.prevThinking = "";
        ctx.prevToolCount = 0;
        store.setIsStreaming(true);
        store.addMessage({
          id: agentRunId,
          role: "assistant",
          content: "",
          timestamp: payload.ts ?? Date.now(),
          streaming: true,
        });
      }
      messageId = agentRunId;
    }

    if (phase === "start" && toolName && toolCallId) {
      store.appendToolUse(messageId, {
        name: toolName,
        input: (payload.data.args as Record<string, unknown>) ?? {},
        toolCallId,
        status: "running",
      });
    } else if (phase === "result" && toolCallId) {
      const result =
        typeof payload.data.result === "string"
          ? payload.data.result
          : JSON.stringify(payload.data.result ?? "");
      store.updateToolUseResult(
        messageId,
        toolCallId,
        result,
        (payload.data.isError as boolean) ?? false,
      );
    }
  }

  // Lifecycle events: capture run metadata (model, usage, duration).
  if (payload.stream === "lifecycle") {
    const phase = payload.data.phase as string | undefined;
    if (phase === "end" || phase === "error") {
      const model = payload.data.model as string | undefined;
      const provider = payload.data.provider as string | undefined;
      const usage = payload.data.usage as
        | { input?: number; output?: number; cacheRead?: number }
        | undefined;
      const endedAt = payload.data.endedAt as number | undefined;
      const startedAt = payload.data.startedAt as number | undefined;
      if (model || usage) {
        const targetId = ctx.streamingRunId ?? agentRunId;
        store.setRunMetadata(targetId, {
          model,
          provider,
          usage: usage
            ? { input: usage.input, output: usage.output, cache: usage.cacheRead }
            : undefined,
          durationMs: endedAt && startedAt ? endedAt - startedAt : undefined,
          startedAt,
        });
      }
    }
  }

  // Thinking stream: append reasoning traces to the current message.
  if (payload.stream === "thinking") {
    const text = payload.data.text as string | undefined;
    if (text && ctx.streamingRunId) {
      store.appendThinking(ctx.streamingRunId, text);
    } else if (text && !ctx.streamingRunId) {
      // Thinking arrived before chat delta — create placeholder
      ctx.streamingRunId = agentRunId;
      ctx.prevThinking = "";
      ctx.prevToolCount = 0;
      store.setIsStreaming(true);
      store.addMessage({
        id: agentRunId,
        role: "assistant",
        content: "",
        timestamp: payload.ts ?? Date.now(),
        streaming: true,
        thinking: text,
      });
    }
  }
}
