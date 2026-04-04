"use client";

import { useEffect, useRef } from "react";
import { deckStream } from "@/lib/deck-client";
import { useChatStore } from "@/stores/chat";
import type {
  AgentEventPayload,
  ChatEventPayload,
  SessionMessageEventPayload,
  SessionToolEventPayload,
  SessionsChangedEventPayload,
} from "@/types/gateway-protocol.generated";
import {
  type ChatStoreAPI,
  type StreamingTracker,
  dispatchChatEvent,
  dispatchAgentEvent,
  dispatchApproval,
  dispatchApprovalResolved,
  dispatchSessionMessageEvent,
  dispatchSessionStateEvent,
} from "@/stores/chat-dispatchers";
import { DEFAULT_EVICT_IDLE_MS } from "@/stores/chat-types";
import { fetchChatSnapshot, persistChatProjection } from "./chat-api";
import { normalizeHistoryMessages } from "./history-normalize";

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

// ---------------------------------------------------------------------------
// projection.gap recovery — in-flight guard prevents concurrent fetches
// ---------------------------------------------------------------------------

let _gapRecoveryInFlight = false;

/**
 * Handle a projection.gap SSE event — the server detected that the client
 * missed events from the outbox (e.g. due to pruning or long disconnect).
 *
 * Recovery: evict stale cached sessions (they may hold outdated state),
 * then refetch the active session's snapshot so the user sees current data.
 * An in-flight guard coalesces rapid consecutive gap events.
 *
 * @internal — exported for testing only
 */
export async function handleProjectionGap(): Promise<void> {
  if (_gapRecoveryInFlight) {
    return;
  }
  _gapRecoveryInFlight = true;
  try {
    const store = useChatStore.getState();

    // Evict non-active, non-streaming sessions — their cached state is
    // potentially stale after the gap. They will be refetched on next access.
    store.evictStale(0);

    const { activeSessionKey, activeAgentId } = store;
    if (!activeSessionKey) {
      return;
    }

    // Skip refetch if the active session is currently streaming — SSE events
    // are the source of truth during streaming, and reloadFullContent handles
    // the final sync.
    const session = store.sessions.get(activeSessionKey);
    if (session?.isStreaming) {
      return;
    }

    const snapshot = await fetchChatSnapshot({
      sessionKey: activeSessionKey,
      agentId: activeAgentId ?? undefined,
    });

    // Re-read store — state may have changed during the async fetch.
    // Guard against session switch or streaming start during the fetch.
    const currentStore = useChatStore.getState();
    if (currentStore.activeSessionKey !== activeSessionKey) {
      return;
    }
    const currentSession = currentStore.sessions.get(activeSessionKey);
    if (currentSession?.isStreaming) {
      return;
    }

    const msgs = normalizeHistoryMessages(activeSessionKey, snapshot.messages);
    const currentMessages = currentSession?.messages ?? [];

    // Preserve locally-added messages for brand-new sessions
    if (!(msgs.length === 0 && currentMessages.length > 0)) {
      currentStore.setMessages(activeSessionKey, msgs);
    }

    currentStore.setActiveApproval(activeSessionKey, snapshot.activeApproval);
    currentStore.setA2UIState(activeSessionKey, snapshot.a2uiState);

    // Sync session metadata (status, timing) — consistent with ChatPanel
    if (snapshot.meta) {
      const meta = snapshot.meta;
      currentStore.updateSessionState(activeSessionKey, {
        status:
          meta.status === "running" ||
          meta.status === "done" ||
          meta.status === "failed" ||
          meta.status === "killed" ||
          meta.status === "timeout"
            ? meta.status
            : undefined,
        startedAt: meta.startedAt,
        endedAt: meta.endedAt,
        runtimeMs: meta.runtimeMs,
        fastMode: meta.fastMode,
      });
    }
  } catch {
    // Snapshot fetch failed — non-critical, user can manually refresh
  } finally {
    _gapRecoveryInFlight = false;
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
              JSON.parse(event.data) as SessionToolEventPayload,
              api,
              trackersRef.current,
            );
            return;
          }
          if (event.event === "session-msg") {
            dispatchSessionMessageEvent(
              JSON.parse(event.data) as SessionMessageEventPayload,
              api,
            );
            return;
          }
          if (event.event === "session-state") {
            dispatchSessionStateEvent(JSON.parse(event.data) as SessionsChangedEventPayload, api);
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
            return;
          }
          if (event.event === "projection.gap") {
            void handleProjectionGap();
            return;
          }
        } catch {
          // ignore malformed SSE payloads
        }
      },
    }).catch(() => {
      // keep silent — deckStream already retries until aborted
    });

    // Aggressively evict idle sessions when the page goes hidden to free memory.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        useChatStore.getState().evictStale(DEFAULT_EVICT_IDLE_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []); // empty deps — stream lives for the component lifetime
}
