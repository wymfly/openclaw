"use client";

import { Bug, Loader2, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionA2UI, useSessionA2UIEvents } from "@/stores/chat-hooks";
import { A2UIBridge, sendUserActionToAgent, type UserAction } from "./a2ui-bridge";
import { CanvasDebugPanel } from "./CanvasDebugPanel";

type CanvasState = "loading" | "ready" | "error" | "empty";

interface CanvasPanelProps {
  onClose: () => void;
}

export function CanvasPanel({ onClose }: CanvasPanelProps) {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const a2uiState = useSessionA2UI();
  const events = useSessionA2UIEvents();
  const [state, setState] = useState<CanvasState>("loading");
  const [showDebug, setShowDebug] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<A2UIBridge | null>(null);
  const prevSessionRef = useRef<string | null>(null);

  // Capture state in a ref so the loading timeout can read it without re-running effect
  const stateRef = useRef(state);
  stateRef.current = state;

  // Create bridge and attach to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !activeSessionKey) {
      return;
    }

    const sessionKey = activeSessionKey;

    const bridge = new A2UIBridge({
      onReady: () => {
        const cachedEvents = useChatStore.getState().sessions.get(sessionKey)?.a2uiState?.eventLog;
        const hasContent = cachedEvents && cachedEvents.length > 0;
        setState(hasContent ? "ready" : "empty");
        useChatStore.getState().updateA2UIBridgeStatus(sessionKey, "ready");
        // Replay cached events if any
        if (cachedEvents && cachedEvents.length > 0) {
          const inbound = cachedEvents.filter((e) => e.direction === "inbound").map((e) => e.raw);
          if (inbound.length > 0) {
            bridge.pushMessages(inbound);
          }
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
      bridge.detach();
      bridgeRef.current = null;
    };
  }, [activeSessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session switch: reset bridge
  useEffect(() => {
    if (prevSessionRef.current && prevSessionRef.current !== activeSessionKey) {
      bridgeRef.current?.reset();
      setState("loading");
    }
    prevSessionRef.current = activeSessionKey;
  }, [activeSessionKey]);

  // Push new inbound events to iframe
  useEffect(() => {
    if (!bridgeRef.current || events.length === 0) {
      return;
    }
    const last = events[events.length - 1];
    if (last.direction === "inbound") {
      bridgeRef.current.pushMessages([last.raw]);
      setState("ready");
    }
  }, [events]);

  // Consume real-time canvas commands from the store queue (pushed by useChatSSE).
  // The store does not use subscribeWithSelector, so we use plain subscribe with
  // a manual length comparison to detect new commands.
  useEffect(() => {
    let prevLen = 0;
    const unsub = useChatStore.subscribe((state) => {
      if (state.canvasCommands.length <= prevLen) {
        prevLen = state.canvasCommands.length;
        return;
      }
      const cmds = useChatStore.getState().consumeCanvasCommands();
      prevLen = 0; // consumed — reset
      const bridge = bridgeRef.current;
      const iframe = iframeRef.current;

      for (const cmd of cmds) {
        switch (cmd.action) {
          case "navigate":
            if (iframe && cmd.params?.url) {
              iframe.src = `/api/canvas/${cmd.params.url as string}`;
            }
            break;
          case "eval":
            if (bridge && cmd.evalId && cmd.javaScript) {
              void bridge.eval(cmd.javaScript, cmd.evalId).then((result) => {
                fetch("/api/deck/canvas", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ evalId: cmd.evalId, result }),
                }).catch(() => {});
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
            // canvasVisible is already handled in useChatSSE via useUIStore.
            // Here we handle the optional url/path parameter for navigation.
            if (iframe && cmd.params?.url) {
              iframe.src = `/api/canvas/${cmd.params.url as string}`;
            }
            setState("ready");
            break;
        }
      }
    });
    return unsub;
  }, []);

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

  // Suppress lint for unused variables that are part of the interface contract
  void a2uiState;

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
          src="/api/canvas/"
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
