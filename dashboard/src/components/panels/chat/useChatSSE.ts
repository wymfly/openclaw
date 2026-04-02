"use client";

import { useEffect, useRef } from "react";
import { deckStream } from "@/lib/deck-client";
import { useChatStore } from "@/stores/chat";
import {
  type ChatStoreAPI,
  type ChatEventPayload,
  type AgentEventPayload,
  type StreamingTracker,
  dispatchChatEvent,
  dispatchAgentEvent,
  dispatchApproval,
  dispatchApprovalResolved,
  dispatchSessionMessageEvent,
  dispatchSessionStateEvent,
} from "@/stores/chat-dispatchers";
import { persistChatProjection } from "./chat-api";

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

function persistSessionProjection(sessionKey: string) {
  const a2uiState = useChatStore.getState().sessions.get(sessionKey)?.a2uiState ?? null;
  void persistChatProjection({ sessionKey, a2uiState }).catch(() => {});
}

function resolveCanvasSessionKey(data: CanvasCommand): string | null {
  const paramSessionKey =
    typeof data.params?.sessionKey === "string" ? data.params.sessionKey : undefined;
  return paramSessionKey ?? useChatStore.getState().activeSessionKey ?? null;
}

function handleCanvasEvent(data: CanvasCommand) {
  const sessionKey = resolveCanvasSessionKey(data);
  if (!sessionKey) {
    return;
  }

  const store = useChatStore.getState();
  store.ensureSession(sessionKey);
  const url = typeof data.params?.url === "string" ? data.params.url : undefined;
  const appendInboundEvent = (action: string, raw: unknown, summary: string) => {
    store.appendA2UIEvent(sessionKey, {
      timestamp: Date.now(),
      direction: "inbound",
      action,
      summary,
      raw,
    });
  };

  switch (data.action) {
    case "present":
      store.setA2UIState(sessionKey, {
        visible: true,
        ...(url ? { url } : {}),
      });
      if (url) {
        appendInboundEvent("present", { url }, "Canvas present");
      }
      store.pushCanvasCommand(sessionKey, data);
      persistSessionProjection(sessionKey);
      break;
    case "hide":
      store.setA2UIState(sessionKey, {
        visible: false,
      });
      persistSessionProjection(sessionKey);
      break;
    case "navigate":
      if (url) {
        store.setA2UIState(sessionKey, { url });
        appendInboundEvent("navigate", { url }, "Canvas navigate");
        persistSessionProjection(sessionKey);
      }
      store.pushCanvasCommand(sessionKey, data);
      break;
    case "eval":
      if (typeof data.javaScript === "string" && data.javaScript.trim()) {
        appendInboundEvent("eval", { javaScript: data.javaScript }, "Canvas eval");
        persistSessionProjection(sessionKey);
      }
      store.pushCanvasCommand(sessionKey, data);
      break;
    case "a2ui_push":
      store.setA2UIState(sessionKey, { visible: true });
      appendInboundEvent("a2ui_push", data.params?.jsonl ?? data.params ?? null, "A2UI push");
      store.pushCanvasCommand(sessionKey, data);
      persistSessionProjection(sessionKey);
      break;
    case "a2ui_reset":
      store.setA2UIState(sessionKey, null);
      store.pushCanvasCommand(sessionKey, data);
      persistSessionProjection(sessionKey);
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
      updateSessionState: (...a) => getStore().updateSessionState(...a),
      resetSessionProjection: (...a) => getStore().resetSessionProjection(...a),
      updateSessionMeta: (sessionKey, patch) => {
        useChatStore.setState((s) => {
          const idx = s.sessionMetas.findIndex((m) => m.key === sessionKey);
          if (idx < 0) {
            return {};
          }
          const metas = [...s.sessionMetas];
          metas[idx] = { ...metas[idx], ...patch };
          return { sessionMetas: metas, sessionMeta: metas };
        });
      },
    };

    const controller = new AbortController();
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        if (!event.event || !event.data) {
          return;
        }
        try {
          if (event.event === "chat") {
            dispatchChatEvent(JSON.parse(event.data) as ChatEventPayload, api, trackersRef.current);
            return;
          }
          if (event.event === "agent") {
            dispatchAgentEvent(
              JSON.parse(event.data) as AgentEventPayload,
              api,
              trackersRef.current,
            );
            return;
          }
          if (event.event === "session-tool") {
            dispatchAgentEvent(
              JSON.parse(event.data) as AgentEventPayload,
              api,
              trackersRef.current,
            );
            return;
          }
          if (event.event === "session-msg") {
            dispatchSessionMessageEvent(JSON.parse(event.data) as Record<string, unknown>, api);
            return;
          }
          if (event.event === "session-state") {
            dispatchSessionStateEvent(JSON.parse(event.data) as Record<string, unknown>, api);
            return;
          }
          if (event.event === "approval.pending") {
            const payload = JSON.parse(event.data) as {
              sessionKey?: string;
              id: string;
              command?: string;
              cwd?: string;
            };
            if (payload.sessionKey) {
              dispatchApproval(
                {
                  sessionKey: payload.sessionKey,
                  id: payload.id,
                  toolName: "command",
                  command: payload.command,
                  description: payload.cwd,
                },
                api,
              );
            }
            return;
          }
          if (event.event === "approval.resolved") {
            const payload = JSON.parse(event.data) as { sessionKey?: string };
            if (payload.sessionKey) {
              dispatchApprovalResolved({ sessionKey: payload.sessionKey }, api);
            }
            return;
          }
          if (event.event === "canvas") {
            handleCanvasEvent(JSON.parse(event.data) as CanvasCommand);
          }
        } catch {
          // ignore malformed SSE payloads
        }
      },
    }).catch(() => {
      // keep silent — deckStream already retries until aborted
    });

    return () => controller.abort();
  }, []); // empty deps — stream lives for the component lifetime
}
