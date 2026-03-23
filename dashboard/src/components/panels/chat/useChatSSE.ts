"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import {
  type ChatStoreAPI,
  type ChatEventPayload,
  type AgentEventPayload,
  createDispatcherContext,
  dispatchChatEvent,
  dispatchAgentEvent,
} from "@/stores/chat-dispatchers";

/**
 * Connect to the SSE stream and dispatch chat/agent events to the store.
 *
 * All event processing logic lives in chat-dispatchers.ts (pure functions).
 * This hook only manages the EventSource lifecycle and wires dispatchers.
 */
export function useChatSSE() {
  const store = useChatStore();
  const ctxRef = useRef(createDispatcherContext());

  useEffect(() => {
    const api: ChatStoreAPI = {
      addMessage: store.addMessage,
      updateStreamingMessage: store.updateStreamingMessage,
      finalizeStreamingMessage: store.finalizeStreamingMessage,
      appendThinking: store.appendThinking,
      appendToolUse: store.appendToolUse,
      updateToolUseResult: store.updateToolUseResult,
      setIsStreaming: store.setIsStreaming,
      setError: store.setError,
      setRunMetadata: store.setRunMetadata,
      getMessages: () => useChatStore.getState().messages,
    };

    const es = new EventSource("/api/stream");

    es.addEventListener("chat", (e) => {
      dispatchChatEvent(JSON.parse(e.data) as ChatEventPayload, api, ctxRef.current);
    });

    es.addEventListener("agent", (e) => {
      dispatchAgentEvent(JSON.parse(e.data) as AgentEventPayload, api, ctxRef.current);
    });

    return () => es.close();
  }, [
    store.addMessage,
    store.updateStreamingMessage,
    store.finalizeStreamingMessage,
    store.appendThinking,
    store.appendToolUse,
    store.updateToolUseResult,
    store.setIsStreaming,
    store.setError,
    store.setRunMetadata,
  ]);
}
