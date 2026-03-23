"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import {
  type ChatStoreAPI,
  type ChatEventPayload,
  type AgentEventPayload,
  type StreamingTracker,
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
  const trackersRef = useRef(new Map<string, StreamingTracker>());

  useEffect(() => {
    const api: ChatStoreAPI = {
      ensureSession: store.ensureSession,
      addMessage: store.addMessage,
      updateStreamingContent: store.updateStreamingContent,
      appendContentBlock: store.appendContentBlock,
      finalizeMessage: store.finalizeMessage,
      setSessionStreaming: store.setSessionStreaming,
      setStreaming: store.setStreaming,
      setSessionError: store.setSessionError,
      setRunMetadata: store.setRunMetadata,
      setActiveApproval: store.setActiveApproval,
      appendA2UIEvent: store.appendA2UIEvent,
      updateA2UISurfaces: store.updateA2UISurfaces,
      setA2UIState: store.setA2UIState,
      setMessages: store.setMessages,
      getSessionMessages: (key) => useChatStore.getState().sessions.get(key)?.messages ?? [],
      updateToolProgress: store.updateToolProgress,
    };

    const es = new EventSource("/api/stream");

    es.addEventListener("chat", (e) => {
      dispatchChatEvent(JSON.parse(e.data) as ChatEventPayload, api, trackersRef.current);
    });

    es.addEventListener("agent", (e) => {
      dispatchAgentEvent(JSON.parse(e.data) as AgentEventPayload, api, trackersRef.current);
    });

    return () => es.close();
  }, [store]);
}
