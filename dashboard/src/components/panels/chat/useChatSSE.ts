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
 *
 * NOTE: We use useChatStore.getState() inside the effect (not the reactive hook)
 * to avoid re-creating the EventSource on every store mutation.
 */
export function useChatSSE() {
  const trackersRef = useRef(new Map<string, StreamingTracker>());

  useEffect(() => {
    const getStore = () => useChatStore.getState();

    const api: ChatStoreAPI = {
      ensureSession: (...a) => getStore().ensureSession(...a),
      addMessage: (...a) => getStore().addMessage(...a),
      updateStreamingContent: (...a) => getStore().updateStreamingContent(...a),
      appendContentBlock: (...a) => getStore().appendContentBlock(...a),
      finalizeMessage: (...a) => getStore().finalizeMessage(...a),
      setSessionStreaming: (...a) => getStore().setSessionStreaming(...a),
      setStreaming: (...a) => getStore().setStreaming(...a),
      setSessionError: (...a) => getStore().setSessionError(...a),
      setRunMetadata: (...a) => getStore().setRunMetadata(...a),
      setActiveApproval: (...a) => getStore().setActiveApproval(...a),
      appendA2UIEvent: (...a) => getStore().appendA2UIEvent(...a),
      updateA2UISurfaces: (...a) => getStore().updateA2UISurfaces(...a),
      setA2UIState: (...a) => getStore().setA2UIState(...a),
      setMessages: (...a) => getStore().setMessages(...a),
      getSessionMessages: (key) => getStore().sessions.get(key)?.messages ?? [],
      updateToolProgress: (...a) => getStore().updateToolProgress(...a),
    };

    const es = new EventSource("/api/stream");

    es.addEventListener("chat", (e) => {
      dispatchChatEvent(JSON.parse(e.data) as ChatEventPayload, api, trackersRef.current);
    });

    es.addEventListener("agent", (e) => {
      dispatchAgentEvent(JSON.parse(e.data) as AgentEventPayload, api, trackersRef.current);
    });

    return () => es.close();
  }, []); // empty deps — EventSource lives for the component lifetime
}
