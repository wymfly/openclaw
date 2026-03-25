"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import { useUIStore } from "@/stores/ui";
import {
  type ChatStoreAPI,
  type ChatEventPayload,
  type AgentEventPayload,
  type StreamingTracker,
  dispatchChatEvent,
  dispatchAgentEvent,
} from "@/stores/chat-dispatchers";

// ---------------------------------------------------------------------------
// Canvas event handler — invoked from the SSE "canvas" event listener.
// Uses getState() (not hooks) since this runs inside an event callback.
// ---------------------------------------------------------------------------

interface CanvasCommand {
  action: string;
  params?: Record<string, unknown>;
  evalId?: string;
  javaScript?: string;
}

function handleCanvasEvent(data: CanvasCommand) {
  const { setCanvasVisible } = useUIStore.getState();

  switch (data.action) {
    case "present":
      setCanvasVisible(true);
      // Store present params for CanvasPanel to consume when it mounts
      useChatStore.getState().pushCanvasCommand(data);
      break;
    case "hide":
      setCanvasVisible(false);
      break;
    case "navigate":
    case "eval":
    case "a2ui_push":
    case "a2ui_reset":
      // Queue for CanvasPanel to consume when mounted
      useChatStore.getState().pushCanvasCommand(data);
      break;
  }
}

/**
 * Connect to the SSE stream and dispatch chat/agent/canvas events to the store.
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

    es.addEventListener("canvas", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as CanvasCommand;
        handleCanvasEvent(data);
      } catch {
        // ignore parse errors
      }
    });

    return () => es.close();
  }, []); // empty deps — EventSource lives for the component lifetime

  // Register/unregister canvas session with the backend
  useEffect(() => {
    fetch("/api/deck/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register" }),
    }).catch(() => {});
    return () => {
      fetch("/api/deck/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unregister" }),
      }).catch(() => {});
    };
  }, []);
}
