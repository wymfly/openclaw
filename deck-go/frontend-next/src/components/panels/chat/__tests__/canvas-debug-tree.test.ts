// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deckFetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
  return new Response("{}", { status: 200 });
});

vi.mock("@/lib/deck-client", () => ({
  deckFetch: deckFetchMock,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    (
      ({
        debugMessages: "Messages",
        debugTree: "Tree",
        debugEvents: `Events ${values?.count ?? 0}`,
        debugClear: "Clear",
        debugTreeUnavailable: "Tree unavailable",
        debugRefreshTree: "Refresh Tree",
      }) as const
    )[
      key as
        | "debugMessages"
        | "debugTree"
        | "debugEvents"
        | "debugClear"
        | "debugTreeUnavailable"
        | "debugRefreshTree"
    ] ?? key,
}));

describe("Canvas tree data plumbing", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const { useChatStore } = await import("@/stores/chat");
    useChatStore.setState({
      sessions: new Map(),
      sessionMetas: [],
      sessionMeta: [],
      activeSessionKey: null,
      activeAgentId: null,
      canvasCommands: [],
      sseStatus: "disconnected",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("calls onTreeData when receiving an a2ui:tree-data message", async () => {
    const { A2UIBridge } = await import("../a2ui-bridge");
    const onTreeData = vi.fn();
    const bridge = new A2UIBridge({
      onReady: vi.fn(),
      onUserAction: vi.fn(),
      onSurfacesChanged: vi.fn(),
      onTreeData,
    });

    const iframe = document.createElement("iframe");
    iframe.src = `${window.location.origin}/canvas`;
    document.body.appendChild(iframe);

    bridge.attach(iframe);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "a2ui:tree-data",
          tree: { root: { id: "1", children: [] } },
        },
      }),
    );

    expect(onTreeData).toHaveBeenCalledWith({ root: { id: "1", children: [] } });

    bridge.detach();
    iframe.remove();
  });

  it("stores and clears treeData through setA2UIState", async () => {
    const { useChatStore } = await import("@/stores/chat");
    useChatStore.getState().ensureSession("s1");

    useChatStore.getState().setA2UIState("s1", {
      treeData: { root: "test" },
    });
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.treeData).toEqual({
      root: "test",
    });

    useChatStore.getState().setA2UIState("s1", {
      treeData: undefined,
    });
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.treeData).toBeUndefined();
  });

  it("renders stored treeData and queues request_tree refresh commands", async () => {
    const { useChatStore } = await import("@/stores/chat");
    const { CanvasDebugPanel } = await import("../CanvasDebugPanel");
    const store = useChatStore.getState();

    store.ensureSession("s1");
    store.setActiveSession("s1");
    store.setA2UIState("s1", {
      eventLog: [],
      surfaces: ["main"],
      treeData: { root: { id: "1", children: [] } },
    });

    render(createElement(CanvasDebugPanel));
    fireEvent.click(screen.getByRole("button", { name: "Tree" }));

    expect(screen.getByText(/"root"/)).toBeDefined();
    fireEvent.click(screen.getByTitle("Refresh Tree"));

    const commands = useChatStore.getState().consumeCanvasCommands("s1");
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      sessionKey: "s1",
      action: "request_tree",
    });
  });

  it("falls back to surfaces when treeData is unavailable", async () => {
    const { useChatStore } = await import("@/stores/chat");
    const { CanvasDebugPanel } = await import("../CanvasDebugPanel");
    const store = useChatStore.getState();

    store.ensureSession("s1");
    store.setActiveSession("s1");
    store.setA2UIState("s1", {
      eventLog: [],
      surfaces: ["main", "sidebar"],
    });

    render(createElement(CanvasDebugPanel));
    fireEvent.click(screen.getByRole("button", { name: "Tree" }));

    expect(screen.getByText("main")).toBeDefined();
    expect(screen.getByText("sidebar")).toBeDefined();
  });

  it("omits treeData and bridgeStatus when persisting the projection", async () => {
    const { persistChatProjection } = await import("../chat-api");

    await persistChatProjection({
      sessionKey: "s1",
      a2uiState: {
        visible: true,
        url: "http://localhost:3000/canvas",
        bridgeStatus: "ready",
        treeData: { root: "test" },
      },
    });

    const init = deckFetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const body = JSON.parse(init?.body ?? "{}") as {
      sessionKey?: string;
      a2uiState?: Record<string, unknown>;
    };

    expect(body).toEqual({
      sessionKey: "s1",
      a2uiState: {
        visible: true,
        url: "http://localhost:3000/canvas",
      },
    });
  });
});
