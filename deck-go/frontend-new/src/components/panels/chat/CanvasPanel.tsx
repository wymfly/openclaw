import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { BugIcon, LoaderIcon, MonitorDotIcon, RefreshIcon, XIcon } from "@/deck-ui/icons";
import { Button } from "@/design-system/atoms/Button";
import { IconButton } from "@/design-system/atoms/IconButton";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionA2UI } from "@/stores/chat-hooks";
import { A2UIBridge, sendUserActionToAgent, type UserAction } from "./a2ui-bridge";
import { CanvasDebugPanel } from "./CanvasDebugPanel";
import "./chat-canvas.css";
import { persistChatProjection, resolveCanvasEval, setCanvasBridgeReady } from "./chat-api";

type CanvasState = "loading" | "ready" | "error" | "empty";

interface CanvasPanelProps {
  onClose: () => void;
}

type CanvasCommand = ReturnType<typeof useChatStore.getState>["canvasCommands"][number];

const VISUAL_STATE_ENV = "VITE_DECK_VISUAL_STATE";

function visualSeedCanvasHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
        font-family: "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --bg-2: #14171c;
        --bg-elev: #1c2028;
        --text-1: #e6e8ec;
        --text-2: #a8aeba;
        --text-3: #8992a3;
        --border-subtle: #1f2530;
        --accent: #7aa2ff;
        --accent-bg: #1a2342;
        --accent-dim: #4f72c7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg-elev);
        color: var(--text-1);
        font-size: 13.5px;
        line-height: 1.5;
      }
      main {
        min-height: 100vh;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cp-card {
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        overflow: hidden;
      }
      .cp-card-h {
        padding: 6px 10px;
        background: var(--bg-2);
        border-bottom: 1px solid var(--border-subtle);
        color: var(--text-2);
        font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 11px;
      }
      .cp-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        padding: 5px 10px;
        border-bottom: 1px solid var(--border-subtle);
        font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 12px;
      }
      .cp-row:last-child { border-bottom: 0; }
      .cp-row:first-of-type {
        background: var(--bg-2);
        color: var(--text-3);
        font-size: 11px;
      }
      .cp-actions {
        display: flex;
        gap: 8px;
        padding: 0 0 4px;
      }
      button {
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        padding: 6px 10px;
        background: transparent;
        color: var(--text-2);
        font: inherit;
      }
      button.primary {
        background: var(--accent-bg);
        border-color: var(--accent-dim);
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="cp-card">
        <div class="cp-card-h">DataTable</div>
        <div class="cp-row"><span>id</span><span>tokens</span><span>cost</span></div>
        <div class="cp-row"><span>m1</span><span>4,218</span><span>$0.018</span></div>
        <div class="cp-row"><span>m2</span><span>9,772</span><span>$0.043</span></div>
        <div class="cp-row"><span>m3</span><span>1,204</span><span>$0.006</span></div>
      </section>
      <div class="cp-actions">
        <button type="button">Refresh</button>
        <button type="button" class="primary">Export</button>
      </div>
    </main>
  </body>
</html>`;
}

function canResolveVisualSeedCanvas() {
  return (
    import.meta.env.DEV ||
    import.meta.env.MODE === "test" ||
    import.meta.env[VISUAL_STATE_ENV] === "1"
  );
}

function resolveCanvasSrc(url: string | null): string {
  if (!url) {
    return "/api/canvas/index.html";
  }
  if (canResolveVisualSeedCanvas() && url.startsWith("visual-seed:")) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(visualSeedCanvasHtml())}`;
  }
  if (/^(https?:|data:|blob:)/.test(url)) {
    return url;
  }
  if (url.startsWith("/api/canvas/")) {
    return url;
  }
  if (url.startsWith("/__openclaw__/canvas/")) {
    return `/api/canvas/${url.slice("/__openclaw__/canvas/".length)}`;
  }
  if (url.startsWith("/__openclaw__/a2ui/")) {
    return `/api/canvas/${url.slice("/__openclaw__/a2ui/".length)}`;
  }
  return `/api/canvas/${url.replace(/^\/+/, "")}`;
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

  const hasTranslation = (key: string) => typeof t.has === "function" && t.has(key);
  const tFallback = (key: string, fallback: string) => (hasTranslation(key) ? t(key) : fallback);
  const bridgeStatus = a2uiState?.bridgeStatus;
  const bridgeStatusKey = bridgeStatus ?? (resolvedCanvasUrl ? "ready" : "disconnected");
  const bridgeStatusLabel = (() => {
    if (bridgeStatus === "ready") {
      return tFallback("canvasBridgeReady", "ready");
    }
    if (bridgeStatus === "error") {
      return tFallback("canvasBridgeError", "handshake failed");
    }
    if (bridgeStatus === "connecting") {
      return tFallback("canvasBridgeConnecting", "connecting");
    }
    return tFallback("canvasBridgeDisconnected", "disconnected");
  })();
  const refreshLabel = tFallback("canvasRefresh", "Refresh canvas");

  return (
    <section className="ds-canvas-panel deck-ui-canvas-panel" aria-label={t("canvasTitle")}>
      <header className="ds-canvas-panel__header deck-ui-canvas-header">
        <MonitorDotIcon className="ds-canvas-panel__title-icon" aria-hidden="true" />
        <div className="ds-canvas-panel__title-stack">
          <span className="ds-canvas-panel__title">{t("canvasTitle")}</span>
          <span className="ds-canvas-panel__sub" data-bridge={bridgeStatusKey}>
            a2ui-bridge · {bridgeStatusLabel}
          </span>
        </div>
        <span className="ds-canvas-panel__header-spacer" />
        <IconButton
          size="sm"
          aria-label={t("debugTitle")}
          title={t("debugTitle")}
          onClick={() => setShowDebug((value) => !value)}
        >
          <BugIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("debugTitle")}</span>
        </IconButton>
        <IconButton size="sm" aria-label={refreshLabel} title={refreshLabel} onClick={handleRetry}>
          <RefreshIcon />
          <span className="ds-sr-only deck-ui-sr-only">{refreshLabel}</span>
        </IconButton>
        <IconButton
          size="sm"
          aria-label={t("canvasCollapse")}
          title={t("canvasCollapse")}
          onClick={onClose}
        >
          <XIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("canvasCollapse")}</span>
        </IconButton>
      </header>

      <div className="ds-canvas-panel__viewport deck-ui-canvas-viewport">
        <div className="ds-canvas-panel__iframe-mock">
          <div className="ds-canvas-panel__iframe-bar" data-bridge={bridgeStatusKey}>
            <span>a2ui:tree</span>
            <span className="ds-canvas-panel__iframe-bar-sep">·</span>
            <span>
              {a2uiState?.surfaces?.length ?? 0} surface
              {(a2uiState?.surfaces?.length ?? 0) === 1 ? "" : "s"}
            </span>
            <span className="ds-canvas-panel__iframe-bar-sep">·</span>
            <span>{bridgeStatusLabel}</span>
          </div>
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="ds-canvas-panel__frame deck-ui-canvas-frame"
            sandbox="allow-scripts allow-same-origin"
            title="A2UI Canvas"
          />
        </div>
        {state === "loading" ? (
          <div className="ds-canvas-panel__overlay deck-ui-canvas-overlay">
            <LoaderIcon className="ds-canvas-panel__spinner deck-ui-canvas-spinner" />
            <span className="ds-canvas-panel__overlay-text">{t("canvasLoading")}</span>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="ds-canvas-panel__overlay deck-ui-canvas-overlay">
            <XIcon className="ds-canvas-panel__overlay-icon" aria-hidden="true" />
            <span className="ds-canvas-panel__overlay-text">
              {tFallback("canvasErrorMessage", "Bridge handshake failed")}
            </span>
            <Button variant="ghost" size="sm" onClick={handleRetry}>
              <RefreshIcon />
              {t("canvasRetry")}
            </Button>
          </div>
        ) : null}
        {state === "empty" ? (
          <div className="ds-canvas-panel__overlay deck-ui-canvas-overlay">
            <MonitorDotIcon className="ds-canvas-panel__overlay-icon" aria-hidden="true" />
            <span className="ds-canvas-panel__overlay-text">{t("canvasEmpty")}</span>
            <span className="ds-canvas-panel__overlay-hint">
              {tFallback("canvasEmptyHint", "Waiting for the agent to push canvas content")}
            </span>
          </div>
        ) : null}
      </div>

      {showDebug ? <CanvasDebugPanel /> : null}
    </section>
  );
}
