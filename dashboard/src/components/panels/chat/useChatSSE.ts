"use client";

import { useEffect, useRef } from "react";
import { useChatStore, type ContentBlock, type ActiveApproval } from "@/stores/chat";

/**
 * Gateway chat event payload shape (from ChatEventSchema):
 *   { runId, sessionKey, seq, state: "delta"|"final"|"error"|"aborted",
 *     message?: { role, content: [{type:"text",text}], timestamp },
 *     errorMessage?, stopReason? }
 */
type ChatEventPayload = {
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

function extractTextFromMessage(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("");
}

/** Map a raw Gateway/Anthropic block to a typed ContentBlock. */
function mapBlock(block: Record<string, unknown>): ContentBlock {
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

/**
 * Reload the last assistant message from chat.history to get full content
 * blocks (tool_use, tool_result, thinking, image). Called after the `final`
 * SSE event so that the in-memory message reflects what the Gateway persisted.
 *
 * Retry policy: try twice with a 1 s delay. On failure, keep existing text.
 */
async function reloadLastMessage(
  sessionKey: string,
  messageId: string,
  replaceMessageContent: (id: string, blocks: ContentBlock[]) => void,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const params = new URLSearchParams({ sessionKey, limit: "5" });
      const res = await fetch(`/api/chat/history?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { messages?: Array<Record<string, unknown>> };
      const messages = Array.isArray(data) ? data : (data.messages ?? []);
      // Find the last assistant message
      const lastAssistant = [...messages].toReversed().find((m) => m.role === "assistant");
      if (lastAssistant && Array.isArray(lastAssistant.content)) {
        const blocks = (lastAssistant.content as Record<string, unknown>[]).map(mapBlock);
        replaceMessageContent(messageId, blocks);
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

/**
 * Connect to the SSE stream and dispatch chat events to the store.
 *
 * Two-path design:
 *   - `delta` events: update streaming text blocks in real-time for typing effect
 *   - `final` event: finalize, then reload full content blocks from chat.history
 *
 * Reconnection: The native EventSource API automatically reconnects with
 * ~3 s delay. The server supports `Last-Event-ID` replay, so no events
 * are lost during brief disconnections.
 */
export function useChatSSE() {
  const {
    addMessage,
    updateStreamingBlocks,
    replaceMessageContent,
    finalizeStreamingMessage,
    setIsStreaming,
    setError,
    setActiveApproval,
  } = useChatStore();
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const streamingRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    // Gateway broadcasts all chat events under the `chat` event type.
    // The `state` field distinguishes delta / final / error / aborted.
    es.addEventListener("chat", (e) => {
      const payload = JSON.parse(e.data) as ChatEventPayload;

      if (payload.state === "delta") {
        const text = extractTextFromMessage(payload.message);
        if (!streamingRunIdRef.current && payload.runId) {
          streamingRunIdRef.current = payload.runId;
          setIsStreaming(true);
          addMessage({
            id: payload.runId,
            role: "assistant",
            content: [{ type: "text", text }],
            timestamp: payload.message?.timestamp ?? Date.now(),
            streaming: true,
          });
        } else if (streamingRunIdRef.current) {
          // Gateway sends the full accumulated text each delta, not incremental.
          updateStreamingBlocks(streamingRunIdRef.current, [{ type: "text", text }]);
        }
        return;
      }

      if (payload.state === "final") {
        const text = extractTextFromMessage(payload.message);
        const runId = streamingRunIdRef.current;
        if (runId) {
          if (text) {
            updateStreamingBlocks(runId, [{ type: "text", text }]);
          }
          finalizeStreamingMessage(runId);
          streamingRunIdRef.current = null;
          // Reload full content blocks (tool_use, tool_result, thinking, image)
          const sessionKey = payload.sessionKey || activeSessionId;
          if (sessionKey) {
            void reloadLastMessage(sessionKey, runId, replaceMessageContent);
          }
        } else if (text && payload.runId) {
          // Final without any preceding delta (e.g., command response)
          addMessage({
            id: payload.runId,
            role: "assistant",
            content: [{ type: "text", text }],
            timestamp: payload.message?.timestamp ?? Date.now(),
          });
        }
        setIsStreaming(false);
        return;
      }

      if (payload.state === "error") {
        setError(payload.errorMessage ?? "Unknown error");
        if (streamingRunIdRef.current) {
          finalizeStreamingMessage(streamingRunIdRef.current);
          streamingRunIdRef.current = null;
        }
        setIsStreaming(false);
        return;
      }

      if (payload.state === "aborted") {
        if (streamingRunIdRef.current) {
          finalizeStreamingMessage(streamingRunIdRef.current);
          streamingRunIdRef.current = null;
        }
        setIsStreaming(false);
      }
    });

    // Agent tool-execution events (tool_use blocks from running agent).
    // Map to a ContentBlock and append to the current streaming message.
    es.addEventListener("agent", (e) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        const stream = payload.stream as string | undefined;
        const data = payload.data as Record<string, unknown> | undefined;
        if (stream === "tool" && data && streamingRunIdRef.current) {
          const toolName = data.name as string | undefined;
          if (toolName) {
            const block: ContentBlock = {
              type: "tool_use",
              id: (data.id as string | undefined) ?? `tool-${Date.now()}`,
              name: toolName,
              input: (data.input as Record<string, unknown> | undefined) ?? {},
            };
            // Append the tool_use block alongside any existing text blocks
            useChatStore.setState((state) => ({
              messages: state.messages.map((m) =>
                m.id === streamingRunIdRef.current ? { ...m, content: [...m.content, block] } : m,
              ),
            }));
          }
        }
      } catch {
        // Ignore malformed payloads
      }
    });

    // Tool execution approval requested — store in chat store for ApprovalDialog.
    es.addEventListener("exec.approval.requested", (e) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        const approval: ActiveApproval = {
          id: (payload.id as string | undefined) ?? "",
          toolName:
            (payload.toolName as string | undefined) ??
            (payload.command as string | undefined) ??
            "unknown",
          command: payload.command as string | undefined,
          description: payload.description as string | undefined,
        };
        if (approval.id) {
          setActiveApproval(approval);
        }
      } catch {
        // Ignore malformed payloads
      }
    });

    // Approval resolved — clear the dialog.
    es.addEventListener("exec.approval.resolved", () => {
      setActiveApproval(null);
    });

    // A2UI events — update artifact panel state.
    // Currently a stub; integration with ArtifactContext requires
    // prop-drilling or a separate artifact store (deferred to a future task).
    es.addEventListener("a2ui", (_e) => {
      // TODO: wire to ArtifactContext or a dedicated artifact store
    });

    return () => es.close();
  }, [
    addMessage,
    updateStreamingBlocks,
    replaceMessageContent,
    finalizeStreamingMessage,
    setIsStreaming,
    setError,
    setActiveApproval,
    activeSessionId,
  ]);
}
