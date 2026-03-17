"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";

/** Connect to the SSE stream and dispatch chat events to the store. */
export function useChatSSE() {
  const { addMessage, updateStreamingMessage, finalizeStreamingMessage, setIsStreaming, setError } =
    useChatStore();

  const streamingMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.addEventListener("chat.delta", (e) => {
      const payload = JSON.parse(e.data) as { content?: string; id?: string };
      if (!streamingMsgIdRef.current && payload.id) {
        streamingMsgIdRef.current = payload.id;
        addMessage({
          id: payload.id,
          role: "assistant",
          content: payload.content ?? "",
          timestamp: Date.now(),
          streaming: true,
        });
      } else if (streamingMsgIdRef.current) {
        const current =
          useChatStore.getState().messages.find((m) => m.id === streamingMsgIdRef.current)
            ?.content ?? "";
        updateStreamingMessage(streamingMsgIdRef.current, current + (payload.content ?? ""));
      }
    });

    es.addEventListener("chat.final", (e) => {
      const msgId = streamingMsgIdRef.current;
      if (msgId) {
        const payload = JSON.parse(e.data) as { content?: string };
        if (payload.content) {
          updateStreamingMessage(msgId, payload.content);
        }
        finalizeStreamingMessage(msgId);
        streamingMsgIdRef.current = null;
      }
      setIsStreaming(false);
    });

    es.addEventListener("chat.error", (e) => {
      const payload = JSON.parse(e.data) as { message?: string };
      setError(payload.message ?? "Unknown error");
      if (streamingMsgIdRef.current) {
        finalizeStreamingMessage(streamingMsgIdRef.current);
        streamingMsgIdRef.current = null;
      }
      setIsStreaming(false);
    });

    return () => es.close();
  }, [addMessage, updateStreamingMessage, finalizeStreamingMessage, setIsStreaming, setError]);
}
