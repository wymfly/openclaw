"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";

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

/** Connect to the SSE stream and dispatch chat events to the store. */
export function useChatSSE() {
  const { addMessage, updateStreamingMessage, finalizeStreamingMessage, setIsStreaming, setError } =
    useChatStore();

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
            content: text,
            timestamp: payload.message?.timestamp ?? Date.now(),
            streaming: true,
          });
        } else if (streamingRunIdRef.current) {
          // Gateway sends the full accumulated text each delta, not incremental.
          updateStreamingMessage(streamingRunIdRef.current, text);
        }
        return;
      }

      if (payload.state === "final") {
        const text = extractTextFromMessage(payload.message);
        if (streamingRunIdRef.current) {
          if (text) {
            updateStreamingMessage(streamingRunIdRef.current, text);
          }
          finalizeStreamingMessage(streamingRunIdRef.current);
          streamingRunIdRef.current = null;
        } else if (text && payload.runId) {
          // Final without any preceding delta (e.g., command response)
          addMessage({
            id: payload.runId,
            role: "assistant",
            content: text,
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

    return () => es.close();
  }, [addMessage, updateStreamingMessage, finalizeStreamingMessage, setIsStreaming, setError]);
}
