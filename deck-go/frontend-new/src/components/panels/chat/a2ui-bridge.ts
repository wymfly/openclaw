import { extractActionName, formatA2UIAgentMessage } from "./a2ui-message-format";
import { sendChatMessage } from "./chat-api";

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
  private listener: ((event: MessageEvent) => void) | null = null;
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
    this.listener = (event: MessageEvent) => {
      if (event.origin !== this.iframeOrigin) {
        return;
      }
      const data = event.data as Record<string, unknown> | undefined;
      switch (data?.type) {
        case "a2ui:ready":
          this.callbacks.onReady();
          break;
        case "a2ui:action":
          if (data.userAction) {
            this.callbacks.onUserAction(data.userAction as UserAction);
          }
          break;
        case "a2ui:surfaces-changed":
          if (Array.isArray(data.surfaces)) {
            this.callbacks.onSurfacesChanged(data.surfaces);
          }
          break;
        case "a2ui:tree-data":
          this.callbacks.onTreeData?.(data.tree);
          break;
        case "a2ui:eval-result":
          if (typeof data.evalId === "string" && this.evalCallbacks.has(data.evalId)) {
            this.evalCallbacks.get(data.evalId)?.(data.result);
            this.evalCallbacks.delete(data.evalId);
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
    await sendChatMessage({ message, sessionKey });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
