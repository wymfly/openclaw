"use client";

import { Bug, Loader2, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionA2UI } from "@/stores/chat-hooks";
import { A2UIBridge, sendUserActionToAgent, type UserAction } from "./a2ui-bridge";
import { CanvasDebugPanel } from "./CanvasDebugPanel";
import { persistChatProjection, resolveCanvasEval, setCanvasBridgeReady } from "./chat-api";

type CanvasState = "loading" | "ready" | "error" | "empty";

interface CanvasPanelProps {
  onClose: () => void;
}

export function CanvasPanel({ onClose }: CanvasPanelProps) {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const a2uiState = useSessionA2UI(activeSessionKey ?? undefined);
  const [state, setState] = useState<CanvasState>("loading");
  const [showDebug, setShowDebug] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<A2UIBridge | null>(null);
  const prevSessionRef = useRef<string | null>(null);

  // Capture state in a ref so the loading timeout can read it without re-running effect
  const stateRef = useRef(state);
  stateRef.current = state;

  const persistProjection = useCallback((sessionKey: string) => {
    const a2uiState = useChatStore.getState().sessions.get(sessionKey)?.a2uiState ?? null;
    void persistChatProjection({ sessionKey, a2uiState }).catch(() => {});
  }, []);

  const resolvedCanvasUrl =
    typeof a2uiState?.url === "string" && a2uiState.url.trim() ? a2uiState.url.trim() : null;
  const iframeSrc = resolvedCanvasUrl
    ? /^https?:\/\//.test(resolvedCanvasUrl)
      ? resolvedCanvasUrl
      : `/api/canvas/${resolvedCanvasUrl}`
    : "/api/canvas/index.html";

  // Create bridge and attach to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !activeSessionKey) {
      return;
    }

    const sessionKey = activeSessionKey;

    const bridge = new A2UIBridge({
      onReady: () => {
        const cachedState = useChatStore.getState().sessions.get(sessionKey)?.a2uiState;
        const cachedEvents = cachedState?.eventLog ?? [];
        const hasContent =
          cachedEvents.length > 0 ||
          Boolean(cachedState?.url) ||
          Boolean(cachedState?.surfaces && cachedState.surfaces.length > 0);
        setState(hasContent ? "ready" : "empty");
        useChatStore.getState().updateA2UIBridgeStatus(sessionKey, "ready");
        void setCanvasBridgeReady({ sessionKey, ready: true }).catch(() => {});
        // Replay cached inbound state so a reopened panel matches the last visible canvas.
        if (cachedEvents.length > 0) {
          const replayEvals: string[] = [];
          const inbound: unknown[] = [];
          for (const event of cachedEvents) {
            if (event.direction !== "inbound") {
              continue;
            }
            if (event.action === "a2ui_push") {
              inbound.push(event.raw);
              continue;
            }
            if (
              event.action === "eval" &&
              event.raw &&
              typeof event.raw === "object" &&
              typeof (event.raw as { javaScript?: unknown }).javaScript === "string"
            ) {
              replayEvals.push((event.raw as { javaScript: string }).javaScript);
            }
          }
          if (inbound.length > 0) {
            bridge.pushMessages(inbound);
          }
          replayEvals.forEach((javaScript, index) => {
            void bridge.eval(javaScript, `replay-${sessionKey}-${index}`);
          });
        }
      },
      onUserAction: (action: UserAction) => {
        // Record outbound event
        useChatStore.getState().appendA2UIEvent(sessionKey, {
          timestamp: Date.now(),
          direction: "outbound",
          action: "userAction",
          summary: `action=${action.name}`,
          raw: action,
        });
        persistProjection(sessionKey);
        void sendUserActionToAgent(action, sessionKey).then(({ ok, error }) => {
          bridge.sendActionStatus(action.id, ok, error);
        });
      },
      onSurfacesChanged: (surfaces: string[]) => {
        useChatStore.getState().updateA2UISurfaces(sessionKey, surfaces);
        if (surfaces.length > 0) {
          setState("ready");
        } else {
          setState("empty");
          useChatStore.getState().setA2UIState(sessionKey, { visible: false });
        }
        persistProjection(sessionKey);
      },
    });
    bridge.attach(iframe);
    bridgeRef.current = bridge;
    useChatStore.getState().updateA2UIBridgeStatus(sessionKey, "connecting");

    // Loading timeout
    const timeout = setTimeout(() => {
      if (stateRef.current === "loading") {
        setState("error");
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      void setCanvasBridgeReady({ sessionKey, ready: false }).catch(() => {});
      bridge.detach();
      bridgeRef.current = null;
    };
  }, [activeSessionKey, persistProjection]);

  useEffect(() => {
    if (resolvedCanvasUrl) {
      setState("ready");
    }
  }, [resolvedCanvasUrl]);

  // Session switch: reset bridge
  useEffect(() => {
    if (prevSessionRef.current && prevSessionRef.current !== activeSessionKey) {
      bridgeRef.current?.reset();
      setState("loading");
    }
    prevSessionRef.current = activeSessionKey;
  }, [activeSessionKey]);

  // Consume real-time canvas commands from the store queue (pushed by useChatSSE).
  // The store does not use subscribeWithSelector, so we use plain subscribe with
  // a manual length comparison to detect new commands.
  useEffect(() => {
    if (!activeSessionKey) {
      return;
    }

    const processCanvasCommands = (
      cmds: Array<{
        sessionKey: string;
        action: string;
        params?: Record<string, unknown>;
        evalId?: string;
        javaScript?: string;
      }>,
    ) => {
      const bridge = bridgeRef.current;
      const iframe = iframeRef.current;

      for (const cmd of cmds) {
        switch (cmd.action) {
          case "navigate":
            if (iframe && cmd.params?.url) {
              const url = cmd.params.url as string;
              iframe.src = /^https?:\/\//.test(url) ? url : `/api/canvas/${url}`;
            }
            break;
          case "eval":
            if (bridge && cmd.evalId && cmd.javaScript) {
              const evalId = cmd.evalId;
              void bridge.eval(cmd.javaScript, evalId).then((result) => {
                void resolveCanvasEval({ evalId, result }).catch(() => {});
              });
            }
            break;
          case "a2ui_push":
            if (bridge && cmd.params?.jsonl) {
              bridge.pushMessages([cmd.params.jsonl]);
              setState("ready");
            }
            break;
          case "a2ui_reset":
            bridge?.reset();
            setState("empty");
            break;
          case "present":
            // Visibility is already tracked in session-scoped A2UI state.
            // Here we only handle the optional url/path parameter for navigation.
            if (iframe && cmd.params?.url) {
              const url = cmd.params.url as string;
              iframe.src = /^https?:\/\//.test(url) ? url : `/api/canvas/${url}`;
            }
            setState("ready");
            break;
        }
      }
    };

    // Drain any commands that arrived before mount
    const initial = useChatStore.getState().consumeCanvasCommands(activeSessionKey);
    if (initial.length > 0) {
      processCanvasCommands(initial);
    }

    // Then subscribe for future changes
    let prevLen = 0;
    const unsub = useChatStore.subscribe((state) => {
      if (state.canvasCommands.length <= prevLen) {
        prevLen = state.canvasCommands.length;
        return;
      }
      const cmds = useChatStore.getState().consumeCanvasCommands(activeSessionKey);
      prevLen = 0; // consumed — reset
      processCanvasCommands(cmds);
    });
    return unsub;
  }, [activeSessionKey]);

  const handleRetry = useCallback(() => {
    setState("loading");
    const iframe = iframeRef.current;
    if (iframe) {
      // Force reload by reading then re-assigning through a local variable
      const currentSrc = iframe.src;
      iframe.src = "";
      iframe.src = currentSrc;
    }
  }, []);
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0">
        <span className="flex-1 text-xs font-medium text-[var(--foreground)]">
          {t("canvasTitle")}
        </span>
        <button
          type="button"
          onClick={() => setShowDebug(!showDebug)}
          className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
          title={t("debugTitle")}
        >
          <Bug size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
          title={t("canvasCollapse")}
        >
          <X size={14} />
        </button>
      </div>

      {/* Canvas viewport */}
      <div className="flex-1 relative min-h-0">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="A2UI Canvas"
        />
        {/* Overlay states */}
        {state === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--background)]">
            <Loader2 size={20} className="animate-spin text-[var(--primary)]" />
            <span className="text-xs text-[var(--muted-foreground)]">{t("canvasLoading")}</span>
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--background)]">
            <span className="text-xs text-[var(--destructive)]">{t("canvasError")}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RefreshCw size={12} />
              {t("canvasRetry")}
            </button>
          </div>
        )}
        {state === "empty" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]">
            <span className="text-xs text-[var(--muted-foreground)]">{t("canvasEmpty")}</span>
          </div>
        )}
      </div>

      {/* Debug panel */}
      {showDebug && <CanvasDebugPanel />}
    </div>
  );
}
