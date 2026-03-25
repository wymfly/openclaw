"use client";

import { extractActionName, formatA2UIAgentMessage } from "./a2ui-message-format";

export interface UserAction {
  id: string;
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface A2UIBridgeCallbacks {
  onReady: () => void;
  onUserAction: (action: UserAction) => void;
  onSurfacesChanged: (surfaces: string[]) => void;
  onTreeData?: (tree: unknown) => void;
}

export class A2UIBridge {
  private iframe: HTMLIFrameElement | null = null;
  private listener: ((e: MessageEvent) => void) | null = null;
  private iframeOrigin = "";
  private evalCallbacks = new Map<string, (result: unknown) => void>();

  constructor(private callbacks: A2UIBridgeCallbacks) {}

  attach(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;
    try {
      this.iframeOrigin = new URL(iframe.src).origin;
    } catch {
      this.iframeOrigin = window.location.origin;
    }
    this.listener = (e: MessageEvent) => {
      if (e.origin !== this.iframeOrigin) {
        return;
      }
      switch (e.data?.type) {
        case "a2ui:ready":
          this.callbacks.onReady();
          break;
        case "a2ui:action":
          if (e.data.userAction) {
            this.callbacks.onUserAction(e.data.userAction as UserAction);
          }
          break;
        case "a2ui:surfaces-changed":
          if (Array.isArray(e.data.surfaces)) {
            this.callbacks.onSurfacesChanged(e.data.surfaces);
          }
          break;
        case "a2ui:tree-data":
          this.callbacks.onTreeData?.(e.data.tree);
          break;
        case "a2ui:eval-result":
          if (e.data.evalId && this.evalCallbacks.has(e.data.evalId)) {
            this.evalCallbacks.get(e.data.evalId)!(e.data.result);
            this.evalCallbacks.delete(e.data.evalId);
          }
          break;
      }
    };
    window.addEventListener("message", this.listener);
  }

  detach(): void {
    if (this.listener) {
      window.removeEventListener("message", this.listener);
      this.listener = null;
    }
    this.iframe = null;
    this.evalCallbacks.clear();
  }

  pushMessages(messages: unknown[]): void {
    this.iframe?.contentWindow?.postMessage({ type: "a2ui:push", messages }, this.iframeOrigin);
  }

  reset(): void {
    this.iframe?.contentWindow?.postMessage({ type: "a2ui:reset" }, this.iframeOrigin);
  }

  sendActionStatus(id: string, ok: boolean, error?: string): void {
    this.iframe?.contentWindow?.postMessage(
      { type: "a2ui:action-status", id, ok, error: error ?? "" },
      this.iframeOrigin,
    );
  }

  requestTree(): void {
    this.iframe?.contentWindow?.postMessage({ type: "a2ui:get-tree" }, this.iframeOrigin);
  }

  eval(javaScript: string, evalId: string): Promise<unknown> {
    return new Promise((resolve) => {
      this.evalCallbacks.set(evalId, resolve);
      this.iframe?.contentWindow?.postMessage(
        { type: "a2ui:eval", evalId, javaScript },
        this.iframeOrigin,
      );
    });
  }
}

/**
 * Send a userAction as a chat message to the agent.
 * Matches the format used by iOS/Android/macOS native clients.
 */
export async function sendUserActionToAgent(
  action: UserAction,
  sessionKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const name = extractActionName(action as unknown as Record<string, unknown>);
  if (!name) {
    return { ok: false, error: "no action name" };
  }

  const message = formatA2UIAgentMessage({
    actionName: name,
    sessionKey,
    surfaceId: action.surfaceId ?? "main",
    sourceComponentId: action.sourceComponentId ?? "-",
    contextJson: action.context ? JSON.stringify(action.context) : undefined,
  });

  try {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionKey }),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
