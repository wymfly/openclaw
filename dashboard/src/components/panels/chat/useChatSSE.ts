"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";

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

type ChatEventPayload = {
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

function extractTextFromMessage(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("");
}

function extractThinking(message?: ChatEventPayload["message"]): string {
  if (!message?.content) {
    return "";
  }
  return message.content
    .filter((block) => block.type === "thinking" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("");
}

type ToolUseInfo = { name: string; input: Record<string, unknown>; result?: string };

function extractToolUse(message?: ChatEventPayload["message"]): ToolUseInfo[] {
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

/**
 * Connect to the SSE stream and dispatch chat events to the store.
 *
 * Reconnection: The native EventSource API automatically reconnects with
 * ~3 s delay. The server supports `Last-Event-ID` replay, so no events
 * are lost during brief disconnections.
 */
/**
 * Agent event payload shape (from AgentEventPayload):
 *   { runId, seq, stream: "lifecycle"|"tool"|"assistant"|"error",
 *     ts, data: Record<string, unknown>, sessionKey? }
 */
type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};

export function useChatSSE() {
  const {
    addMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    appendThinking,
    appendToolUse,
    updateToolUseResult,
    setIsStreaming,
    setError,
  } = useChatStore();

  const streamingRunIdRef = useRef<string | null>(null);
  const prevThinkingRef = useRef<string>("");
  const prevToolCountRef = useRef<number>(0);

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
          prevThinkingRef.current = "";
          prevToolCountRef.current = 0;
          setIsStreaming(true);
          addMessage({
            id: payload.runId,
            role: "assistant",
            content: text,
            timestamp: payload.message?.timestamp ?? Date.now(),
            streaming: true,
          });
        } else if (streamingRunIdRef.current) {
          // Gateway sends the full accumulated text each delta, not incremental.
          updateStreamingMessage(streamingRunIdRef.current, text);
        }

        // Extract and append thinking traces (incremental diff)
        if (streamingRunIdRef.current) {
          const thinking = extractThinking(payload.message);
          if (thinking && thinking !== prevThinkingRef.current) {
            const newPart = thinking.slice(prevThinkingRef.current.length);
            if (newPart) {
              appendThinking(streamingRunIdRef.current, newPart);
            }
            prevThinkingRef.current = thinking;
          }

          // Extract tool_use blocks (append only new ones)
          const tools = extractToolUse(payload.message);
          if (tools.length > prevToolCountRef.current) {
            for (let i = prevToolCountRef.current; i < tools.length; i++) {
              appendToolUse(streamingRunIdRef.current, tools[i]);
            }
            prevToolCountRef.current = tools.length;
          }
        }
        return;
      }

      if (payload.state === "final") {
        const text = extractTextFromMessage(payload.message);
        if (streamingRunIdRef.current) {
          if (text) {
            updateStreamingMessage(streamingRunIdRef.current, text);
          }

          // Final thinking/tool_use extraction
          const thinking = extractThinking(payload.message);
          if (thinking && thinking !== prevThinkingRef.current) {
            const newPart = thinking.slice(prevThinkingRef.current.length);
            if (newPart) {
              appendThinking(streamingRunIdRef.current, newPart);
            }
          }
          const tools = extractToolUse(payload.message);
          if (tools.length > prevToolCountRef.current) {
            for (let i = prevToolCountRef.current; i < tools.length; i++) {
              appendToolUse(streamingRunIdRef.current, tools[i]);
            }
          }

          finalizeStreamingMessage(streamingRunIdRef.current);
          streamingRunIdRef.current = null;
          prevThinkingRef.current = "";
          prevToolCountRef.current = 0;
        } else if (text && payload.runId) {
          // Final without any preceding delta (e.g., command response)
          const thinking = extractThinking(payload.message);
          const tools = extractToolUse(payload.message);
          addMessage({
            id: payload.runId,
            role: "assistant",
            content: text,
            timestamp: payload.message?.timestamp ?? Date.now(),
            thinking: thinking || undefined,
            toolUse: tools.length > 0 ? tools : undefined,
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
          prevThinkingRef.current = "";
          prevToolCountRef.current = 0;
        }
        setIsStreaming(false);
        return;
      }

      if (payload.state === "aborted") {
        if (streamingRunIdRef.current) {
          finalizeStreamingMessage(streamingRunIdRef.current);
          streamingRunIdRef.current = null;
          prevThinkingRef.current = "";
          prevToolCountRef.current = 0;
        }
        setIsStreaming(false);
      }
    });

    // Gateway broadcasts tool/lifecycle events under the `agent` event type.
    // These carry structured data for tool calls, subagent lifecycle, etc.
    //
    // IMPORTANT: Agent tool events often arrive BEFORE the first chat delta
    // for the same runId, so we cannot rely on streamingRunIdRef. Instead,
    // use the agent event's own runId to find or create the message.
    es.addEventListener("agent", (e) => {
      const payload = JSON.parse(e.data) as AgentEventPayload;
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
        let messageId = streamingRunIdRef.current;
        if (messageId !== agentRunId) {
          // Check if a message with this runId already exists in the store
          const existing = useChatStore.getState().messages.find((m) => m.id === agentRunId);
          if (!existing && phase === "start") {
            // Create a placeholder message — chat delta will update the text later
            streamingRunIdRef.current = agentRunId;
            prevThinkingRef.current = "";
            prevToolCountRef.current = 0;
            setIsStreaming(true);
            addMessage({
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
          appendToolUse(messageId, {
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
          updateToolUseResult(
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
            const targetId = streamingRunIdRef.current ?? agentRunId;
            useChatStore.getState().setRunMetadata(targetId, {
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
        if (text && streamingRunIdRef.current) {
          appendThinking(streamingRunIdRef.current, text);
        } else if (text && !streamingRunIdRef.current) {
          // Thinking arrived before chat delta — create placeholder
          streamingRunIdRef.current = agentRunId;
          prevThinkingRef.current = "";
          prevToolCountRef.current = 0;
          setIsStreaming(true);
          addMessage({
            id: agentRunId,
            role: "assistant",
            content: "",
            timestamp: payload.ts ?? Date.now(),
            streaming: true,
            thinking: text,
          });
        }
      }
    });

    return () => es.close();
  }, [
    addMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    appendThinking,
    appendToolUse,
    updateToolUseResult,
    setIsStreaming,
    setError,
  ]);
}
