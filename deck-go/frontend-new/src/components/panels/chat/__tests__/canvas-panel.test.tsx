// @vitest-environment jsdom
import { NextIntlClientProvider } from "next-intl";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@/stores/chat";
import { CanvasPanel } from "../CanvasPanel";

const chatApi = vi.hoisted(() => ({
  persistChatProjection: vi.fn(),
  resolveCanvasEval: vi.fn(),
  sendChatMessage: vi.fn(),
  setCanvasBridgeReady: vi.fn(),
}));

vi.mock("../chat-api", () => chatApi);

const messages = {
  chat: {
    canvasCollapse: "Collapse canvas",
    canvasEmpty: "No canvas content",
    canvasError: "Canvas failed to load",
    canvasLoading: "Loading canvas...",
    canvasRetry: "Retry",
    canvasTitle: "Canvas",
    debugClear: "Clear",
    debugEvents: "Events {count}",
    debugMessages: "Messages",
    debugRefreshTree: "Refresh Tree",
    debugTitle: "Debug panel",
    debugTree: "Tree",
    debugTreeUnavailable: "Tree unavailable",
  },
};

let container: HTMLDivElement;
let root: Root | null = null;

function resetChatStore() {
  useChatStore.setState({
    sessions: new Map(),
    sessionMetas: [],
    sessionMeta: [],
    sessionPreviewOverlays: {},
    activeSessionKey: null,
    activeAgentId: "main",
    sseStatus: "disconnected",
    canvasCommands: [],
  });
}

function renderCanvasPanel(onClose = vi.fn()) {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages },
        createElement(CanvasPanel, { onClose }),
      ),
    );
  });
}

function dispatchCanvasMessage(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data,
      }),
    );
  });
}

function iframe() {
  const node = container.querySelector("iframe");
  if (!node) {
    throw new Error("iframe not rendered");
  }
  return node;
}

describe("CanvasPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    resetChatStore();
    vi.clearAllMocks();
    chatApi.persistChatProjection.mockResolvedValue(undefined);
    chatApi.resolveCanvasEval.mockResolvedValue(undefined);
    chatApi.sendChatMessage.mockResolvedValue({ status: "started" });
    chatApi.setCanvasBridgeReady.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("drains queued canvas commands and resolves eval results", async () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-canvas");
    store.setActiveSession("sess-canvas");
    store.setA2UIState("sess-canvas", { visible: true });
    store.pushCanvasCommand("sess-canvas", {
      action: "navigate",
      params: { url: "preview.html" },
    });
    store.pushCanvasCommand("sess-canvas", {
      action: "eval",
      evalId: "eval-1",
      javaScript: "1 + 1",
    });

    renderCanvasPanel();

    expect(iframe().src).toContain("/api/runtime/gateway-assets/a2ui/preview.html");
    expect(useChatStore.getState().canvasCommands).toHaveLength(0);

    dispatchCanvasMessage({
      type: "a2ui:eval-result",
      evalId: "eval-1",
      result: 2,
    });

    await vi.waitFor(() => {
      expect(chatApi.resolveCanvasEval).toHaveBeenCalledWith({ evalId: "eval-1", result: 2 });
    });
  });

  it("reports bridge readiness and forwards canvas user actions to the agent", async () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-action");
    store.setActiveSession("sess-action");
    store.setA2UIState("sess-action", { visible: true });

    renderCanvasPanel();
    dispatchCanvasMessage({ type: "a2ui:ready" });

    await vi.waitFor(() => {
      expect(chatApi.setCanvasBridgeReady).toHaveBeenCalledWith({
        sessionKey: "sess-action",
        ready: true,
      });
    });
    expect(useChatStore.getState().sessions.get("sess-action")?.a2uiState?.bridgeStatus).toBe(
      "ready",
    );

    dispatchCanvasMessage({
      type: "a2ui:action",
      userAction: {
        id: "action-1",
        name: "OpenFile",
        surfaceId: "main",
        sourceComponentId: "button-1",
        context: { path: "README.md" },
        timestamp: "2026-04-24T00:00:00Z",
      },
    });

    await vi.waitFor(() => {
      expect(chatApi.sendChatMessage).toHaveBeenCalledWith({
        sessionKey: "sess-action",
        message: expect.stringContaining("action=OpenFile"),
      });
    });

    const events = useChatStore.getState().sessions.get("sess-action")?.a2uiState?.eventLog ?? [];
    expect(events.at(-1)).toMatchObject({
      direction: "outbound",
      action: "userAction",
      summary: "action=OpenFile",
    });
    expect(chatApi.persistChatProjection).toHaveBeenCalledWith({
      sessionKey: "sess-action",
      a2uiState: expect.objectContaining({ bridgeStatus: "ready" }),
    });
  });
});
