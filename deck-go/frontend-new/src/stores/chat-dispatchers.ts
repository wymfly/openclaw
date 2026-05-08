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

import { fetchChatHistory } from "@/api";
import type {
  AgentEventPayload as GatewayAgentEventPayload,
  ChatEventPayload as GatewayChatEventPayload,
  SessionMessageEventPayload,
  SessionToolEventPayload,
  TranscriptMessage,
} from "@/generated/gateway-protocol.generated";
import {
  normalizeSessionMessagePayload,
  normalizeTranscriptMessages,
  normalizeTranscriptToolResultContent,
} from "@/lib/transcript-adapter";
import { invalidateTranscript, setCachedTranscript } from "@/lib/transcript-cache";
import { useSessionsStore, type SessionsChangedPayload } from "@/stores/sessions";
import type {
  ApprovalRequest,
  A2UIEvent,
  ContentBlock,
  ChatMessage,
  RunMetadata,
  SessionMeta,
  SessionState,
} from "./chat-types";

// Re-export types for convenience
export type { ApprovalRequest, A2UIEvent, ContentBlock, ChatMessage };

// ---------------------------------------------------------------------------
// SSE payload types
// ---------------------------------------------------------------------------

export type ChatEventPayload = Omit<GatewayChatEventPayload, "message"> & {
  message?: {
    id?: string;
    role: "user" | "assistant" | "system";
    content: ContentBlock[];
    timestamp?: number;
  };
};
export type AgentEventPayload =
  | (Omit<GatewayAgentEventPayload, "seq" | "ts"> & {
      data: Record<string, unknown>;
      seq?: number;
      ts?: number;
      sessionKey?: string;
    })
  | (Omit<SessionToolEventPayload, "runId" | "seq" | "ts"> & {
      runId?: string;
      seq?: number;
      ts?: number;
      data: SessionToolEventPayload["data"];
      sessionKey?: string;
    });
export type SessionMessagePayload = Omit<SessionMessageEventPayload, "message"> & {
  message?: Record<string, unknown>;
  [key: string]: unknown;
};
export type SessionStatePayload = {
  sessionKey: string;
  ts?: number;
  phase?: string;
  reason?: string;
  runId?: string;
  status?: SessionMessageEventPayload["status"];
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  fastMode?: boolean;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  estimatedCostUsd?: number;
  thinkingLevel?: string;
  verboseLevel?: string;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
  updatedAt?: number;
  sessionId?: string;
  label?: unknown;
  displayName?: unknown;
  compacted?: boolean;
  errorMessage?: string;
  childSessions?: unknown;
  parentSessionKey?: unknown;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Per-session streaming tracker — lightweight mutable state
// ---------------------------------------------------------------------------

export interface StreamingTracker {
  prevThinking: string;
  prevText: string;
  textBase: string;
  textSegmentSealed: boolean;
}

function createStreamingTracker(): StreamingTracker {
  return { prevThinking: "", prevText: "", textBase: "", textSegmentSealed: false };
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

function extractTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function updateLastTextSegment(
  blocks: ContentBlock[],
  nextText: string,
  appendWhenMissing = true,
): ContentBlock[] {
  const lastTextIndex = blocks.map((block) => block.type).lastIndexOf("text");
  const nextBlocks =
    lastTextIndex >= 0
      ? blocks.map((block, index) =>
          index === lastTextIndex && block.type === "text"
            ? ({ type: "text", text: nextText } satisfies ContentBlock)
            : block,
        )
      : blocks;

  if (lastTextIndex < 0 && appendWhenMissing && nextText) {
    return [...blocks, { type: "text", text: nextText } satisfies ContentBlock];
  }
  return nextBlocks;
}

function mergeAuxiliaryBlocks(blocks: ContentBlock[], incoming: ContentBlock[]): ContentBlock[] {
  let next = [...blocks];

  for (const block of incoming) {
    if (block.type === "text" || block.type === "tool_use" || block.type === "tool_result") {
      continue;
    }

    if (block.type === "thinking") {
      const existingIdx = next.findIndex((entry) => entry.type === "thinking");
      if (existingIdx >= 0) {
        next[existingIdx] = block;
      } else {
        next.unshift(block);
      }
      continue;
    }

    const alreadyPresent = next.some((entry) => JSON.stringify(entry) === JSON.stringify(block));
    if (!alreadyPresent) {
      next.push(block);
    }
  }

  return next;
}

function mergeAssistantContent(
  existing: ChatMessage | undefined,
  incoming: ContentBlock[],
  tracker: StreamingTracker,
): ContentBlock[] {
  const incomingText = extractTextFromBlocks(incoming);
  const incomingAuxiliaryBlocks = incoming.filter((block) => block.type !== "text");

  if (!existing) {
    tracker.prevText = incomingText;
    tracker.textBase = "";
    tracker.textSegmentSealed = false;
    return incoming;
  }

  const baseBlocks = mergeAuxiliaryBlocks(existing.content, incomingAuxiliaryBlocks);

  if (!incomingText) {
    return baseBlocks;
  }

  if (tracker.textSegmentSealed) {
    const nextSegment = incomingText.startsWith(tracker.prevText)
      ? incomingText.slice(tracker.prevText.length)
      : incomingText;

    if (!nextSegment) {
      return existing.content;
    }

    tracker.textBase = tracker.prevText;
    tracker.prevText = incomingText;
    tracker.textSegmentSealed = false;
    return [...baseBlocks, { type: "text", text: nextSegment } satisfies ContentBlock];
  }

  const nextSegment = incomingText.startsWith(tracker.textBase)
    ? incomingText.slice(tracker.textBase.length)
    : incomingText;
  tracker.prevText = incomingText;

  return updateLastTextSegment(baseBlocks, nextSegment);
}

function reconcileHistoryWithCurrentSegments(
  currentBlocks: ContentBlock[],
  historyBlocks: ContentBlock[],
): ContentBlock[] {
  const currentTextBlocks = currentBlocks.filter(
    (block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text",
  );
  const historyTextBlocks = historyBlocks.filter(
    (block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text",
  );

  if (currentTextBlocks.length <= 1 || historyTextBlocks.length !== 1) {
    return historyBlocks;
  }

  const authoritativeText = historyTextBlocks[0].text;
  const sealedPrefixText = currentTextBlocks
    .slice(0, -1)
    .map((block) => block.text)
    .join("");
  const finalSegmentText = authoritativeText.startsWith(sealedPrefixText)
    ? authoritativeText.slice(sealedPrefixText.length)
    : authoritativeText;
  const nextTextSegments = currentTextBlocks.map((block, index) =>
    index === currentTextBlocks.length - 1 ? finalSegmentText : block.text,
  );

  const historyToolBlocks = historyBlocks.filter(
    (block) => block.type === "tool_use" || block.type === "tool_result",
  );
  let textIndex = 0;
  let toolIndex = 0;

  return currentBlocks.map((block) => {
    if (block.type === "text") {
      return {
        type: "text",
        text: nextTextSegments[textIndex++] ?? "",
      } satisfies ContentBlock;
    }
    if (block.type === "tool_use" || block.type === "tool_result") {
      return historyToolBlocks[toolIndex++] ?? block;
    }
    return block;
  });
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
  updateSessionState: (
    sessionKey: string,
    patch: Partial<
      Pick<SessionState, "status" | "startedAt" | "endedAt" | "runtimeMs" | "fastMode">
    >,
  ) => void;
  resetSessionProjection: (sessionKey: string) => void;
  /** Update session metadata from SSE events or optimistic updates. */
  updateSessionMeta: (sessionKey: string, patch: Partial<SessionMeta>) => void;
}

// ---------------------------------------------------------------------------
// Default store + trackers — used when callers omit store/trackers args
// ---------------------------------------------------------------------------

/** Shared tracker map for convenience (no-args) dispatch calls. */
const defaultTrackers = new Map<string, StreamingTracker>();

/**
 * Registered default API — populated by chat.ts on store creation.
 * Avoids circular `require("./chat")` during test and app startup.
 */
let _registeredAPI: ChatStoreAPI | null = null;

/** Called by chat.ts after store creation to wire the default API. */
export function registerDefaultChatStoreAPI(api: ChatStoreAPI): void {
  _registeredAPI = api;
}

function getDefaultAPI(): ChatStoreAPI {
  if (!_registeredAPI) {
    throw new Error(
      "Default ChatStoreAPI not registered. " +
        "Either pass `store` explicitly or ensure chat.ts has been imported before dispatchers run.",
    );
  }
  return _registeredAPI;
}

// ---------------------------------------------------------------------------
// Helper functions — kept exported for other consumers
// ---------------------------------------------------------------------------

/**
 * Extract concatenated text from message content blocks.
 * Store state uses ContentBlock[] directly; this helper serves text-only readers.
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
  invalidateTranscript(sessionKey);

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
      tracker.prevText = extractTextFromBlocks(content);
      tracker.textBase = "";
      tracker.textSegmentSealed = false;
      api.addMessage(sessionKey, {
        id: payload.runId,
        role: "assistant",
        content,
        timestamp: payload.message?.timestamp ?? Date.now(),
        streaming: true,
      });
    } else {
      // Subsequent delta — keep assistant turn ownership stable, but never
      // mutate a text segment that was already sealed by tool activity.
      const merged = mergeAssistantContent(existing, content, tracker);
      api.updateStreamingContent(sessionKey, payload.runId, merged);
    }
    return;
  }

  if (payload.state === "final") {
    const content = payload.message?.content ?? [];
    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === payload.runId);

    if (existing) {
      // Was streaming — merge final content with locally-added tool blocks
      if (content.length > 0) {
        const merged = mergeAssistantContent(existing, content, tracker);
        api.updateStreamingContent(sessionKey, payload.runId, merged);
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
    tracker.textSegmentSealed = true;
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
    const abortContent = payload.message?.content ?? [];
    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === payload.runId);

    if (existing) {
      // The abort payload carries the full buffered text (including tokens
      // that were throttled and never sent as a delta).  Merge it in the
      // same way the "final" handler does so the user sees all generated
      // text up to the abort point.
      if (abortContent.length > 0) {
        const merged = mergeAssistantContent(existing, abortContent, tracker);
        api.updateStreamingContent(sessionKey, payload.runId, merged);
      }
      api.finalizeMessage(sessionKey, payload.runId);
    }
    api.setSessionStreaming(sessionKey, false);
    resetTracker(trk, sessionKey);

    // Reload full content from Gateway history (same as "final") so the
    // persisted aborted partial text is authoritative.
    void reloadFullContent(sessionKey, payload.runId, api);
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
  const tracker = getTracker(trk, sessionKey);
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
      tracker.textBase = tracker.prevText;
      tracker.textSegmentSealed = true;
    } else if (phase === "result") {
      api.appendContentBlock(sessionKey, messageId, {
        type: "tool_result",
        toolUseId: toolCallId,
        content: normalizeTranscriptToolResultContent(payload.data.result),
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
      tracker.textBase = tracker.prevText;
      tracker.textSegmentSealed = true;
    } else if (phase === "error") {
      api.updateToolProgress(sessionKey, toolCallId, {
        toolUseId: toolCallId,
        name: (payload.data.name as string) ?? "unknown",
        status: "error",
        startedAt: 0,
      });
      tracker.textBase = tracker.prevText;
      tracker.textSegmentSealed = true;
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
    const delta = payload.data.delta as string | undefined;
    const nextThinking =
      typeof text === "string" && text
        ? text
        : typeof delta === "string" && delta
          ? `${getTracker(trk, sessionKey).prevThinking}${delta}`
          : "";
    if (!nextThinking) {
      return;
    }

    tracker.prevThinking = nextThinking;
    const existingMessages = api.getSessionMessages(sessionKey);
    const existing = existingMessages.find((m) => m.id === agentRunId);

    if (existing) {
      let replaced = false;
      const nextContent = existing.content.map((block) => {
        if (block.type !== "thinking" || replaced) {
          return block;
        }
        replaced = true;
        return {
          type: "thinking",
          text: nextThinking,
        } satisfies ContentBlock;
      });
      api.updateStreamingContent(
        sessionKey,
        existing.id,
        replaced
          ? nextContent
          : [
              ...existing.content,
              {
                type: "thinking",
                text: nextThinking,
              } satisfies ContentBlock,
            ],
      );
    } else if (agentRunId) {
      // Thinking arrived before chat delta — create placeholder
      api.setStreaming(sessionKey, true, agentRunId);
      resetTracker(trk, sessionKey);
      api.addMessage(sessionKey, {
        id: agentRunId,
        role: "assistant",
        content: [{ type: "thinking", text: nextThinking }],
        timestamp: payload.ts ?? Date.now(),
        streaming: true,
      });
      tracker.prevThinking = nextThinking;
    }
  }
}

// ---------------------------------------------------------------------------
// Session/approval/A2UI dispatchers
// ---------------------------------------------------------------------------

export function dispatchSessionMessageEvent(
  payload: SessionMessagePayload,
  store?: ChatStoreAPI,
): void {
  const api = store ?? getDefaultAPI();
  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }
  invalidateTranscript(sessionKey);

  if (!("message" in payload) || !payload.message || typeof payload.message !== "object") {
    dispatchSessionStateEvent(payload, store);
    return;
  }
  const message = normalizeSessionMessagePayload(payload);

  api.ensureSession(sessionKey);
  const messages = api.getSessionMessages(sessionKey);

  // 1. Exact ID match → update existing message
  const exactMatch = messages.find((entry) => entry.id === message.id);
  if (exactMatch) {
    api.updateStreamingContent(sessionKey, message.id, message.content);
    if (exactMatch.streaming) {
      api.finalizeMessage(sessionKey, message.id);
    }
    dispatchSessionStateEvent(payload, store);
    return;
  }

  // 2. Fuzzy dedup — session-msg events from Gateway may echo messages already
  //    added locally (user messages with "user-*" ID) or via chat events
  //    (assistant messages with runId). Detect and skip to prevent duplicates.
  if (findFuzzyDuplicate(messages, message)) {
    dispatchSessionStateEvent(payload, store);
    return;
  }

  api.addMessage(sessionKey, message);
  dispatchSessionStateEvent(payload, store);
}

/**
 * Check if the incoming message is a duplicate of one already present
 * under a different ID. Handles two cases:
 * - User messages added locally with "user-*" ID echoed by Gateway
 * - Assistant messages added via "chat" SSE events echoed via "session-msg"
 */
function findFuzzyDuplicate(
  existing: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage | undefined {
  const incomingText = extractText(incoming);

  if (incoming.role === "user" && incomingText) {
    // Local user messages use "user-<timestamp>" IDs; Gateway echoes use
    // authoritative IDs. Match by text content to detect the echo.
    // Gateway may wrap the original text with "Sender (untrusted metadata): ..."
    // prefix, so use substring containment instead of exact match.
    return existing.find((m) => {
      if (m.role !== "user" || !m.id.startsWith("user-")) {
        return false;
      }
      const existingText = extractText(m);
      if (!existingText) {
        return false;
      }
      return (
        existingText === incomingText ||
        incomingText.includes(existingText) ||
        existingText.includes(incomingText)
      );
    });
  }

  if (incoming.role === "assistant") {
    // Chat events create assistant messages with runId (UUID-like, not the
    // "key:ts:idx" history format). If one exists within a reasonable time
    // window, the session-msg is a redundant echo.
    const isSSEOriginId = (id: string) => !/^[^:]+:\d+:\d+$/.test(id);
    return existing.find(
      (m) =>
        m.role === "assistant" &&
        isSSEOriginId(m.id) &&
        Math.abs(m.timestamp - incoming.timestamp) < 60_000,
    );
  }

  return undefined;
}

/** Extract concatenated text from text-type content blocks. */
function extractText(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text.trim())
    .join("\n");
}

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
 * Fetch full message content from the gateway history API and refresh
 * the text/thinking blocks with the authoritative server version,
 * while preserving tool_use/tool_result blocks collected via SSE.
 *
 * Gateway history uses Anthropic message format where tool_use blocks
 * live in earlier assistant messages, not the final one. So we merge
 * history text with locally-collected tool blocks.
 *
 * Retries once on failure. If both attempts fail, the original content
 * is preserved.
 *
 * IMPORTANT: this function intentionally reads full transcript history through
 * `/api/chat/history`. Do not replace it with `sessions.preview`; preview
 * payloads are summaries, not full transcript equivalents.
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
      const data = (await fetchChatHistory({ limit: 5, sessionKey })) as {
        messages?: TranscriptMessage[];
      };

      if (!data.messages) {
        return;
      }

      const historyMessages = normalizeTranscriptMessages(sessionKey, data.messages);
      const assistantMsg = [...historyMessages]
        .toReversed()
        .find((message) => message.role === "assistant");
      if (!assistantMsg) {
        return;
      }

      // Re-read messages to handle concurrent updates
      const messages = api.getSessionMessages(sessionKey);
      const msgIdx = messages.findIndex((m) => m.id === runId);
      if (msgIdx === -1) {
        return; // Session or message was removed during fetch
      }

      const currentMsg = messages[msgIdx];
      const existingToolBlocks = currentMsg.content.filter(
        (b) => b.type === "tool_use" || b.type === "tool_result",
      );
      const historyToolBlocks = assistantMsg.content.filter(
        (b) => b.type === "tool_use" || b.type === "tool_result",
      );
      const historyNonTool = assistantMsg.content.filter(
        (b) => b.type !== "tool_use" && b.type !== "tool_result",
      );
      const mergedRaw =
        historyToolBlocks.length > 0
          ? assistantMsg.content
          : existingToolBlocks.length > 0
            ? [...existingToolBlocks, ...historyNonTool]
            : assistantMsg.content;
      const merged = reconcileHistoryWithCurrentSegments(currentMsg.content, mergedRaw);

      const updated = [...messages];
      updated[msgIdx] = { ...updated[msgIdx], content: merged };
      api.setMessages(sessionKey, updated);
      setCachedTranscript(sessionKey, updated);
      return;
    } catch {
      // Retry on next iteration
    }
  }
  // Both retries failed — keep original content
}

// ---------------------------------------------------------------------------
// Session state event dispatcher (Layer 2)
// ---------------------------------------------------------------------------

/**
 * Handle a session-state event from SSE.
 * Updates session lifecycle state (streaming, error) based on phase/reason.
 */
export function dispatchSessionStateEvent(
  payload: SessionStatePayload,
  store?: ChatStoreAPI,
): void {
  const api = store ?? getDefaultAPI();
  const statePayload = payload;
  const sessionKey = statePayload.sessionKey;
  if (!sessionKey) {
    return;
  }
  invalidateTranscript(sessionKey);

  // Snapshot token state before compaction resets it (used for CompactionNotice).
  // IMPORTANT: must be captured before applySessionChangedEvent() which
  // synchronously resets tokens to 0 via Zustand set().
  let tokensBefore: number | undefined;
  if (statePayload.compacted === true) {
    const prev = useSessionsStore.getState().sessions.find((s) => s.key === sessionKey);
    if (prev) {
      tokensBefore = prev.totalTokens ?? prev.tokensIn + prev.tokensOut;
    }
  }

  // Unified dispatch: also update the sessions store so non-chat panels
  // (sessions list, monitor) get real-time session state updates.
  // This replaces the unused useSessionEvents.ts hook with a single dispatch path.
  // Safe cast: applySessionChangedEvent guards every field with typeof checks.
  useSessionsStore
    .getState()
    .applySessionChangedEvent(statePayload as unknown as SessionsChangedPayload);

  const phase = typeof statePayload.phase === "string" ? statePayload.phase : undefined;
  const reason = typeof statePayload.reason === "string" ? statePayload.reason : undefined;
  const status = typeof statePayload.status === "string" ? statePayload.status : undefined;
  const startedAt = typeof statePayload.startedAt === "number" ? statePayload.startedAt : undefined;
  const endedAt = typeof statePayload.endedAt === "number" ? statePayload.endedAt : undefined;
  const runtimeMs = typeof statePayload.runtimeMs === "number" ? statePayload.runtimeMs : undefined;
  const fastMode = typeof statePayload.fastMode === "boolean" ? statePayload.fastMode : undefined;

  // Update streaming state based on lifecycle phase
  if (phase === "start" || reason === "send" || reason === "steer") {
    api.setStreaming(
      sessionKey,
      true,
      typeof statePayload.runId === "string" ? statePayload.runId : undefined,
    );
  }
  if (reason === "clear" || reason === "reset" || reason === "deleted" || reason === "delete") {
    api.resetSessionProjection(sessionKey);
  }
  if (phase === "end") {
    api.setStreaming(sessionKey, false);
  }
  if (reason === "abort") {
    api.setStreaming(sessionKey, false);
  }
  if (phase === "error") {
    api.setStreaming(sessionKey, false);
    api.setSessionError(
      sessionKey,
      typeof statePayload.errorMessage === "string" ? statePayload.errorMessage : "Run failed",
    );
  }

  const statePatch: Partial<
    Pick<SessionState, "status" | "startedAt" | "endedAt" | "runtimeMs" | "fastMode">
  > = {};
  if (
    status === "running" ||
    status === "done" ||
    status === "failed" ||
    status === "killed" ||
    status === "timeout" ||
    status === "idle"
  ) {
    statePatch.status = status;
  } else if (phase === "start") {
    statePatch.status = "running";
  } else if (phase === "end") {
    statePatch.status = "done";
  } else if (phase === "error") {
    statePatch.status = "failed";
  } else if (reason === "abort") {
    statePatch.status = "killed";
  }
  if (startedAt !== undefined) {
    statePatch.startedAt = startedAt;
  }
  if (endedAt !== undefined) {
    statePatch.endedAt = endedAt;
  }
  if (runtimeMs !== undefined) {
    statePatch.runtimeMs = runtimeMs;
  }
  if (fastMode !== undefined) {
    statePatch.fastMode = fastMode;
  }
  if (Object.keys(statePatch).length > 0) {
    api.updateSessionState(sessionKey, statePatch);
  }

  // ── Compaction detection ──
  // Gateway sends compacted: true in sessions.changed payload (src/gateway/server-methods/sessions.ts:127)
  if (statePayload.compacted === true) {
    // Dedup: check if last message is a recent compaction notice (within 5s)
    const messages = api.getSessionMessages(sessionKey);
    const lastMsg = messages[messages.length - 1];
    const isRecentCompaction =
      lastMsg?.role === "system" &&
      lastMsg.id.startsWith("compaction-") &&
      Date.now() - lastMsg.timestamp < 5000;

    if (!isRecentCompaction) {
      // Read post-compaction token count from the updated sessions store.
      const postSession = useSessionsStore.getState().sessions.find((s) => s.key === sessionKey);
      const tokensAfter = postSession
        ? (postSession.totalTokens ?? postSession.tokensIn + postSession.tokensOut)
        : undefined;

      api.addMessage(sessionKey, {
        id: `compaction-${Date.now()}`,
        role: "system",
        content: [{ type: "text" as const, text: "compacted" }],
        timestamp: Date.now(),
        tokensBefore,
        tokensAfter,
      });
    }
  }

  // ── Session meta sync (totalTokens, estimatedCostUsd, config fields) ──
  const totalTokens =
    typeof statePayload.totalTokens === "number" ? statePayload.totalTokens : undefined;
  const estimatedCostUsd =
    typeof statePayload.estimatedCostUsd === "number" ? statePayload.estimatedCostUsd : undefined;
  const thinkingLevel =
    typeof statePayload.thinkingLevel === "string" ? statePayload.thinkingLevel : undefined;
  const verboseLevel =
    typeof statePayload.verboseLevel === "string" ? statePayload.verboseLevel : undefined;
  const model = typeof statePayload.model === "string" ? statePayload.model : undefined;
  const rawReasoning = statePayload.reasoningLevel;
  const reasoningLevel: SessionMeta["reasoningLevel"] =
    rawReasoning === "off" || rawReasoning === "on" || rawReasoning === "stream"
      ? rawReasoning
      : undefined;
  const rawUsage = statePayload.responseUsage;
  const responseUsage: SessionMeta["responseUsage"] =
    rawUsage === "off" || rawUsage === "tokens" || rawUsage === "full"
      ? rawUsage
      : rawUsage === "on"
        ? "full"
        : undefined;
  const rawSendPolicy = statePayload.sendPolicy;
  const sendPolicy: SessionMeta["sendPolicy"] =
    rawSendPolicy === "allow" || rawSendPolicy === "deny" ? rawSendPolicy : undefined;
  const contextTokens =
    typeof statePayload.contextTokens === "number" ? statePayload.contextTokens : undefined;

  const metaPatch: Partial<SessionMeta> = {};
  if (totalTokens !== undefined) {
    metaPatch.totalTokens = totalTokens;
  }
  if (estimatedCostUsd !== undefined) {
    metaPatch.estimatedCostUsd = estimatedCostUsd;
  }
  if (thinkingLevel !== undefined) {
    metaPatch.thinkingLevel = thinkingLevel;
  }
  if (fastMode !== undefined) {
    metaPatch.fastMode = fastMode;
  }
  if (verboseLevel !== undefined) {
    metaPatch.verboseLevel = verboseLevel;
  }
  if (model !== undefined) {
    metaPatch.model = model;
  }
  if (reasoningLevel !== undefined) {
    metaPatch.reasoningLevel = reasoningLevel;
  }
  if (responseUsage !== undefined) {
    metaPatch.responseUsage = responseUsage;
  }
  if (sendPolicy !== undefined) {
    metaPatch.sendPolicy = sendPolicy;
  }
  if (status !== undefined) {
    metaPatch.status = status;
  }
  if (startedAt !== undefined) {
    metaPatch.startedAt = startedAt;
  }
  if (endedAt !== undefined) {
    metaPatch.endedAt = endedAt;
  }
  if (runtimeMs !== undefined) {
    metaPatch.runtimeMs = runtimeMs;
  }
  if (contextTokens !== undefined) {
    metaPatch.contextTokens = contextTokens;
  }

  if (Object.keys(metaPatch).length > 0) {
    api.updateSessionMeta(sessionKey, metaPatch);
  }
}
