import { useEffect, useRef, useState } from "react";
import { deckStream } from "@/lib/deck-client";
import { setCachedTranscript } from "@/lib/transcript-cache";
import { useApprovalsStore } from "@/stores/approvals";
import { useChatStore } from "@/stores/chat";
import {
  type AgentEventPayload,
  type ChatEventPayload,
  type ChatStoreAPI,
  type SessionMessagePayload,
  type SessionStatePayload,
  type StreamingTracker,
  dispatchAgentEvent,
  dispatchApproval,
  dispatchApprovalResolved,
  dispatchChatEvent,
  dispatchSessionMessageEvent,
  dispatchSessionStateEvent,
} from "@/stores/chat-dispatchers";
import { DEFAULT_EVICT_IDLE_MS } from "@/stores/chat-types";
import { fetchChatSnapshot, fetchSessionList, persistChatProjection } from "./chat-api";
import { normalizeHistoryMessages } from "./history-normalize";
import { isChatVisualStateRequested } from "./visual-state-seed";

const BROWSER_ONLINE_RECOVERY_RELOAD_DELAY_MS = 8_000;
const STREAM_RECOVERY_RELOAD_COOLDOWN_MS = 60_000;
const STREAM_RECOVERY_QUERY_PARAM = "__deck_recover";
const STREAM_RECOVERY_RELOAD_AT_KEY = "deckGoStreamRecoveryReloadAt";

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
      store.setA2UIState(sessionKey, { visible: false });
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

let projectionGapRecoveryInFlight = false;

function canTriggerStreamRecoveryReload() {
  if (typeof window === "undefined") {
    return false;
  }
  const lastReloadAt = Number(window.localStorage.getItem(STREAM_RECOVERY_RELOAD_AT_KEY) ?? "0");
  return !lastReloadAt || Date.now() - lastReloadAt > STREAM_RECOVERY_RELOAD_COOLDOWN_MS;
}

function markStreamRecoveryReload() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STREAM_RECOVERY_RELOAD_AT_KEY, `${Date.now()}`);
  }
}

function triggerStreamRecoveryNavigation() {
  if (typeof window === "undefined") {
    return;
  }
  const next = new URL(window.location.href);
  next.searchParams.set(STREAM_RECOVERY_QUERY_PARAM, `${Date.now()}`);
  window.location.replace(next.toString());
}

async function refreshActiveChatFromGateway(options: {
  evictIdleMs?: number;
  refreshSessionList?: boolean;
  skipStreaming?: boolean;
}): Promise<void> {
  const store = useChatStore.getState();
  if (options.evictIdleMs !== undefined) {
    store.evictStale(options.evictIdleMs);
  }

  const { activeSessionKey, activeAgentId } = store;

  if (options.refreshSessionList) {
    const metas = await fetchSessionList(activeAgentId ?? undefined);
    useChatStore.getState().setSessionMetas(metas);
  }

  if (!activeSessionKey) {
    return;
  }

  const session = useChatStore.getState().sessions.get(activeSessionKey);
  if (options.skipStreaming !== false && session?.isStreaming) {
    return;
  }

  const snapshot = await fetchChatSnapshot({
    sessionKey: activeSessionKey,
    agentId: activeAgentId ?? undefined,
  });

  const currentStore = useChatStore.getState();
  if (currentStore.activeSessionKey !== activeSessionKey) {
    return;
  }
  const currentSession = currentStore.sessions.get(activeSessionKey);
  if (options.skipStreaming !== false && currentSession?.isStreaming) {
    return;
  }

  const messages = normalizeHistoryMessages(activeSessionKey, snapshot.messages);
  setCachedTranscript(activeSessionKey, messages);
  if (!(messages.length === 0 && (currentSession?.messages.length ?? 0) > 0)) {
    currentStore.setMessages(activeSessionKey, messages);
  }
  currentStore.setActiveApproval(activeSessionKey, snapshot.activeApproval);
  currentStore.setA2UIState(activeSessionKey, snapshot.a2uiState);

  if (snapshot.meta) {
    currentStore.updateSessionState(activeSessionKey, {
      status:
        snapshot.meta.status === "running" ||
        snapshot.meta.status === "done" ||
        snapshot.meta.status === "failed" ||
        snapshot.meta.status === "killed" ||
        snapshot.meta.status === "timeout"
          ? snapshot.meta.status
          : undefined,
      startedAt: snapshot.meta.startedAt,
      endedAt: snapshot.meta.endedAt,
      runtimeMs: snapshot.meta.runtimeMs,
      fastMode: snapshot.meta.fastMode,
    });
  }
}

export async function recoverActiveChatAfterReconnect(): Promise<void> {
  await refreshActiveChatFromGateway({
    refreshSessionList: true,
    skipStreaming: false,
  });
}

export async function handleProjectionGap(): Promise<void> {
  if (projectionGapRecoveryInFlight) {
    return;
  }
  projectionGapRecoveryInFlight = true;
  try {
    await refreshActiveChatFromGateway({
      evictIdleMs: 0,
      skipStreaming: true,
    });
  } catch {
    // keep silent; the next good event or manual refresh will recover
  } finally {
    projectionGapRecoveryInFlight = false;
  }
}

export function useChatSSE() {
  const trackersRef = useRef(new Map<string, StreamingTracker>());
  const streamControllerRef = useRef<AbortController | null>(null);
  const pendingBrowserRecoveryRef = useRef(false);
  const hasConnectedStreamRef = useRef(false);
  const [streamRestartNonce, setStreamRestartNonce] = useState(0);
  const sseStatus = useChatStore((state) => state.sseStatus);

  useEffect(() => {
    const onOffline = () => {
      pendingBrowserRecoveryRef.current = true;
      streamControllerRef.current?.abort();
      useChatStore.getState().setSSEStatus("reconnecting");
    };

    const onOnline = () => {
      pendingBrowserRecoveryRef.current = true;
      useChatStore.getState().setSSEStatus("reconnecting");
      setStreamRestartNonce((current) => current + 1);
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (
      sseStatus !== "reconnecting" ||
      (!hasConnectedStreamRef.current && !pendingBrowserRecoveryRef.current) ||
      !canTriggerStreamRecoveryReload()
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (
        useChatStore.getState().sseStatus !== "reconnecting" ||
        (!hasConnectedStreamRef.current && !pendingBrowserRecoveryRef.current) ||
        !canTriggerStreamRecoveryReload()
      ) {
        return;
      }
      markStreamRecoveryReload();
      triggerStreamRecoveryNavigation();
    }, BROWSER_ONLINE_RECOVERY_RELOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [sseStatus]);

  useEffect(() => {
    if (isChatVisualStateRequested()) {
      return undefined;
    }

    const getStore = () => useChatStore.getState();

    const api: ChatStoreAPI = {
      ensureSession: (...args) => getStore().ensureSession(...args),
      addMessage: (...args) => getStore().addMessage(...args),
      updateStreamingContent: (...args) => getStore().updateStreamingContent(...args),
      appendContentBlock: (...args) => getStore().appendContentBlock(...args),
      finalizeMessage: (...args) => getStore().finalizeMessage(...args),
      setSessionStreaming: (...args) => getStore().setSessionStreaming(...args),
      setStreaming: (...args) => getStore().setStreaming(...args),
      setSessionError: (...args) => getStore().setSessionError(...args),
      setRunMetadata: (...args) => getStore().setRunMetadata(...args),
      setActiveApproval: (...args) => getStore().setActiveApproval(...args),
      appendA2UIEvent: (...args) => getStore().appendA2UIEvent(...args),
      updateA2UISurfaces: (...args) => getStore().updateA2UISurfaces(...args),
      setA2UIState: (...args) => getStore().setA2UIState(...args),
      setMessages: (...args) => getStore().setMessages(...args),
      getSessionMessages: (key) => getStore().sessions.get(key)?.messages ?? [],
      updateToolProgress: (...args) => getStore().updateToolProgress(...args),
      updateSessionState: (...args) => getStore().updateSessionState(...args),
      resetSessionProjection: (...args) => getStore().resetSessionProjection(...args),
      updateSessionMeta: (sessionKey, patch) => {
        useChatStore.setState((state) => {
          const index = state.sessionMetas.findIndex((meta) => meta.key === sessionKey);
          if (index < 0) {
            return {};
          }
          const metas = [...state.sessionMetas];
          metas[index] = { ...metas[index], ...patch };
          return { sessionMetas: metas, sessionMeta: metas };
        });
      },
    };

    const controller = new AbortController();
    streamControllerRef.current = controller;
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onOpen() {
        hasConnectedStreamRef.current = true;
        useChatStore.getState().setSSEStatus("connected");
        if (pendingBrowserRecoveryRef.current) {
          pendingBrowserRecoveryRef.current = false;
          void recoverActiveChatAfterReconnect().catch(() => {});
        }
      },
      onRetry() {
        useChatStore.getState().setSSEStatus("reconnecting");
      },
      onEvent(event) {
        if (!event.event || !event.data) {
          return;
        }
        try {
          if (pendingBrowserRecoveryRef.current && (event.id || event.event || event.data)) {
            pendingBrowserRecoveryRef.current = false;
            void recoverActiveChatAfterReconnect().catch(() => {});
          }
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
          if (event.event === "session-tool" || event.event === "session.tool") {
            dispatchAgentEvent(
              JSON.parse(event.data) as AgentEventPayload,
              api,
              trackersRef.current,
            );
            return;
          }
          if (event.event === "session-msg" || event.event === "session.message") {
            dispatchSessionMessageEvent(JSON.parse(event.data) as SessionMessagePayload, api);
            return;
          }
          if (event.event === "session-state" || event.event === "sessions.changed") {
            dispatchSessionStateEvent(JSON.parse(event.data) as SessionStatePayload, api);
            return;
          }
          if (event.event === "approval.pending") {
            const payload = JSON.parse(event.data) as {
              sessionKey?: string;
              id: string;
              command?: string;
              cwd?: string;
              agentId?: string;
              createdAtMs?: number;
              expiresAtMs?: number;
            };
            if (payload.id) {
              useApprovalsStore.getState().addPending({
                id: payload.id,
                command: payload.command ?? "",
                cwd: payload.cwd,
                agentId: payload.agentId,
                sessionKey: payload.sessionKey,
                createdAtMs: payload.createdAtMs ?? Date.now(),
                expiresAtMs: payload.expiresAtMs ?? Date.now(),
              });
            }
            if (payload.sessionKey) {
              dispatchApproval(
                {
                  sessionKey: payload.sessionKey,
                  id: payload.id,
                  toolName: "command",
                  command: payload.command,
                  description: payload.cwd,
                  cwd: payload.cwd,
                  agentId: payload.agentId,
                  createdAtMs: payload.createdAtMs,
                  expiresAtMs: payload.expiresAtMs,
                },
                api,
              );
            }
            return;
          }
          if (event.event === "approval.resolved") {
            const payload = JSON.parse(event.data) as { id?: string; sessionKey?: string };
            if (payload.id) {
              useApprovalsStore.getState().removePending(payload.id);
            }
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
          }
        } catch {
          // ignore malformed SSE payloads
        }
      },
    }).catch(() => {});

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        useChatStore.getState().evictStale(DEFAULT_EVICT_IDLE_MS);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const currentStatus = useChatStore.getState().sseStatus;
      if (currentStatus !== "reconnecting" && !pendingBrowserRecoveryRef.current) {
        useChatStore.getState().setSSEStatus("disconnected");
      }
    };
  }, [streamRestartNonce]);
}
