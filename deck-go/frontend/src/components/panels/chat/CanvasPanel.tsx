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

type CanvasCommand = ReturnType<typeof useChatStore.getState>["canvasCommands"][number];

function visualSeedCanvasHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      :root { color-scheme: dark; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: #0f0f23; color: #e5e7eb; }
      main { min-height: 100vh; padding: 28px; display: grid; gap: 18px; align-content: start; }
      h1 { margin: 0; font-size: 20px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.5; }
      .grid { display: grid; gap: 10px; }
      .item { border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 12px; background: rgba(255,255,255,.05); }
      .ok { color: #4ade80; font-weight: 700; }
      code { color: #93c5fd; }
    </style>
  </head>
  <body>
    <main>
      <h1>Gateway launch checklist</h1>
      <p>Deterministic Deck visual seed for canvas and artifact drawer review.</p>
      <section class="grid">
        <div class="item"><span class="ok">Ready</span> local source Gateway command</div>
        <div class="item"><span class="ok">Ready</span> <code>NO_PROXY=localhost,127.0.0.1</code></div>
        <div class="item">Next: verify Go API proxy and SSE rendering.</div>
      </section>
    </main>
  </body>
</html>`;
}

function canResolveVisualSeedCanvas() {
  return import.meta.env.DEV || import.meta.env.MODE === "test";
}

function resolveCanvasSrc(url: string | null): string {
  if (!url) {
    return "/api/canvas/index.html";
  }
  if (canResolveVisualSeedCanvas() && url.startsWith("visual-seed:")) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(visualSeedCanvasHtml())}`;
  }
  return /^https?:\/\//.test(url) ? url : `/api/canvas/${url}`;
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
  const stateRef = useRef(state);
  stateRef.current = state;

  const persistProjection = useCallback((sessionKey: string) => {
    const currentA2UI = useChatStore.getState().sessions.get(sessionKey)?.a2uiState ?? null;
    void persistChatProjection({ sessionKey, a2uiState: currentA2UI }).catch(() => {});
  }, []);

  const resolvedCanvasUrl =
    typeof a2uiState?.url === "string" && a2uiState.url.trim() ? a2uiState.url.trim() : null;
  const iframeSrc = resolveCanvasSrc(resolvedCanvasUrl);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !activeSessionKey) {
      return undefined;
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
        bridge.requestTree();
      },
      onUserAction: (action: UserAction) => {
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
      onTreeData: (tree: unknown) => {
        useChatStore.getState().setA2UIState(sessionKey, { treeData: tree });
      },
      onSurfacesChanged: (surfaces: string[]) => {
        useChatStore.getState().updateA2UISurfaces(sessionKey, surfaces);
        if (surfaces.length > 0) {
          setState("ready");
          bridge.requestTree();
        } else {
          setState("empty");
          useChatStore.getState().setA2UIState(sessionKey, {
            visible: false,
            treeData: undefined,
          });
        }
        persistProjection(sessionKey);
      },
    });

    bridge.attach(iframe);
    bridgeRef.current = bridge;
    useChatStore.getState().updateA2UIBridgeStatus(sessionKey, "connecting");

    const timeout = window.setTimeout(() => {
      if (stateRef.current === "loading") {
        setState("error");
      }
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
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

  useEffect(() => {
    if (prevSessionRef.current && prevSessionRef.current !== activeSessionKey) {
      bridgeRef.current?.reset();
      setState("loading");
    }
    prevSessionRef.current = activeSessionKey;
  }, [activeSessionKey]);

  useEffect(() => {
    if (!activeSessionKey) {
      return undefined;
    }

    const processCanvasCommands = (cmds: CanvasCommand[]) => {
      const bridge = bridgeRef.current;
      const iframe = iframeRef.current;

      for (const cmd of cmds) {
        switch (cmd.action) {
          case "navigate":
            if (iframe && typeof cmd.params?.url === "string") {
              iframe.src = resolveCanvasSrc(cmd.params.url);
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
            useChatStore.getState().setA2UIState(activeSessionKey, { treeData: undefined });
            break;
          case "request_tree":
            bridge?.requestTree();
            break;
          case "present":
            if (iframe && typeof cmd.params?.url === "string") {
              iframe.src = resolveCanvasSrc(cmd.params.url);
            }
            setState("ready");
            break;
        }
      }
    };

    const initial = useChatStore.getState().consumeCanvasCommands(activeSessionKey);
    if (initial.length > 0) {
      processCanvasCommands(initial);
    }

    let prevLen = 0;
    const unsubscribe = useChatStore.subscribe((storeState) => {
      if (storeState.canvasCommands.length <= prevLen) {
        prevLen = storeState.canvasCommands.length;
        return;
      }
      const cmds = useChatStore.getState().consumeCanvasCommands(activeSessionKey);
      prevLen = 0;
      processCanvasCommands(cmds);
    });
    return unsubscribe;
  }, [activeSessionKey]);

  const handleRetry = useCallback(() => {
    setState("loading");
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }
    const currentSrc = iframe.src;
    iframe.src = "";
    iframe.src = currentSrc;
  }, []);

  return (
    <section className="deck-ui-canvas-panel" aria-label={t("canvasTitle")}>
      <header className="deck-ui-canvas-header">
        <span>{t("canvasTitle")}</span>
        <div>
          <button type="button" onClick={() => setShowDebug((value) => !value)}>
            {t("debugTitle")}
          </button>
          <button type="button" onClick={onClose}>
            {t("canvasCollapse")}
          </button>
        </div>
      </header>

      <div className="deck-ui-canvas-viewport">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="deck-ui-canvas-frame"
          sandbox="allow-scripts allow-same-origin"
          title="A2UI Canvas"
        />
        {state === "loading" ? (
          <div className="deck-ui-canvas-overlay">
            <span>{t("canvasLoading")}</span>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="deck-ui-canvas-overlay">
            <span>{t("canvasError")}</span>
            <button type="button" onClick={handleRetry}>
              {t("canvasRetry")}
            </button>
          </div>
        ) : null}
        {state === "empty" ? (
          <div className="deck-ui-canvas-overlay">
            <span>{t("canvasEmpty")}</span>
          </div>
        ) : null}
      </div>

      {showDebug ? <CanvasDebugPanel /> : null}
    </section>
  );
}
