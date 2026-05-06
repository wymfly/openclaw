import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EVICT_IDLE_MS } from "@/stores/chat-types";

vi.mock("@/lib/deck-client", () => ({
  deckStream: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  deckFetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
}));

vi.mock("../chat-api", () => ({
  fetchChatSnapshot: vi.fn(),
  fetchSessionList: vi.fn(),
  persistChatProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../history-normalize", () => ({
  normalizeHistoryMessages: vi.fn(() => []),
}));

let useChatSSE: typeof import("../useChatSSE").useChatSSE;
let useChatStore: typeof import("@/stores/chat").useChatStore;
let deckStream: typeof import("@/lib/deck-client").deckStream;
let fetchChatSnapshot: typeof import("../chat-api").fetchChatSnapshot;
let fetchSessionList: typeof import("../chat-api").fetchSessionList;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function HookHost() {
  useChatSSE();
  return null;
}

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ useChatSSE } = await import("../useChatSSE"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ deckStream } = await import("@/lib/deck-client"));
  ({ fetchChatSnapshot, fetchSessionList } = await import("../chat-api"));
  vi.mocked(deckStream).mockClear();
  vi.mocked(fetchChatSnapshot).mockResolvedValue({
    messages: [{ role: "assistant", content: "restored", timestamp: 1 }],
    meta: null,
    activeApproval: null,
    a2uiState: null,
  });
  vi.mocked(fetchSessionList).mockResolvedValue([
    { key: "sess-1", agentId: "main", title: "Recovered", updatedAt: 1 },
  ]);
  useChatStore.setState({
    sessions: new Map(),
    sessionMetas: [],
    sessionMeta: [],
    sessionPreviewOverlays: {},
    activeSessionKey: null,
    activeAgentId: null,
    sseStatus: "disconnected",
    canvasCommands: [],
  });
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container.remove();
});

describe("useChatSSE visibility eviction", () => {
  it("calls evictStale(DEFAULT_EVICT_IDLE_MS) when page goes hidden", async () => {
    const spy = vi.spyOn(useChatStore.getState(), "evictStale");

    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(spy).toHaveBeenCalledWith(DEFAULT_EVICT_IDLE_MS);
  });

  it("does not call evictStale when page becomes visible", async () => {
    const spy = vi.spyOn(useChatStore.getState(), "evictStale");

    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(spy).not.toHaveBeenCalled();
  });

  it("removes the visibility listener on unmount", async () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");

    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it("dispatches chat SSE events into the migrated chat store", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
    streamOptions?.onEvent?.({
      event: "chat",
      data: JSON.stringify({
        sessionKey: "sess-1",
        runId: "run-1",
        state: "delta",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
          timestamp: 123,
        },
      }),
    });

    const session = useChatStore.getState().sessions.get("sess-1");
    expect(session?.isStreaming).toBe(true);
    expect(session?.messages[0]).toMatchObject({
      id: "run-1",
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      streaming: true,
    });
  });

  it("dispatches canonical session.message SSE events into the migrated chat store", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
    streamOptions?.onEvent?.({
      event: "session.message",
      data: JSON.stringify({
        sessionKey: "sess-1",
        message: {
          id: "msg-1",
          role: "assistant",
          content: [{ type: "text", text: "authoritative" }],
          timestamp: 123,
        },
      }),
    });

    const session = useChatStore.getState().sessions.get("sess-1");
    expect(session?.messages[0]).toMatchObject({
      id: "msg-1",
      role: "assistant",
      content: [{ type: "text", text: "authoritative" }],
    });
  });

  it("dispatches canonical session.tool SSE events into the migrated chat store", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
    streamOptions?.onEvent?.({
      event: "session.tool",
      data: JSON.stringify({
        sessionKey: "sess-1",
        runId: "run-1",
        stream: "tool",
        ts: 123,
        data: {
          phase: "start",
          name: "read",
          toolCallId: "tool-1",
          args: { path: "/tmp/report.txt" },
        },
      }),
    });
    streamOptions?.onEvent?.({
      event: "session.tool",
      data: JSON.stringify({
        sessionKey: "sess-1",
        runId: "run-1",
        stream: "tool",
        ts: 124,
        data: {
          phase: "result",
          name: "read",
          toolCallId: "tool-1",
          result: "file contents",
        },
      }),
    });

    const session = useChatStore.getState().sessions.get("sess-1");
    expect(session?.messages[0]).toMatchObject({
      id: "run-1",
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "read",
          input: { path: "/tmp/report.txt" },
        },
        {
          type: "tool_result",
          toolUseId: "tool-1",
          content: "file contents",
          isError: false,
        },
      ],
      streaming: true,
    });
    expect(session?.toolProgress["tool-1"]).toMatchObject({
      name: "read",
      status: "completed",
    });
  });

  it("dispatches canonical sessions.changed SSE events into the migrated chat store", async () => {
    useChatStore.getState().ensureSession("sess-1");

    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
    streamOptions?.onEvent?.({
      event: "sessions.changed",
      data: JSON.stringify({
        sessionKey: "sess-1",
        reason: "send",
        runId: "run-1",
        status: "running",
        startedAt: 123,
      }),
    });

    const session = useChatStore.getState().sessions.get("sess-1");
    expect(session).toMatchObject({
      isStreaming: true,
      streamingRunId: "run-1",
      status: "running",
      startedAt: 123,
    });
  });

  it("debounces transient stream retry status before showing reconnecting", async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root = createRoot(container);
        root.render(<HookHost />);
      });

      const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
      act(() => {
        streamOptions?.onOpen?.();
      });
      expect(useChatStore.getState().sseStatus).toBe("connected");

      act(() => {
        streamOptions?.onRetry?.();
      });
      expect(useChatStore.getState().sseStatus).toBe("connected");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_199);
      });
      expect(useChatStore.getState().sseStatus).toBe("connected");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(useChatStore.getState().sseStatus).toBe("reconnecting");

      act(() => {
        streamOptions?.onOpen?.();
      });
      expect(useChatStore.getState().sseStatus).toBe("connected");
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the active stream while offline and restarts it when the browser returns online", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    const firstOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
    expect(firstOptions?.signal?.aborted).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(firstOptions?.signal?.aborted).toBe(true);
    expect(useChatStore.getState().sseStatus).toBe("reconnecting");

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await vi.waitFor(() => expect(deckStream).toHaveBeenCalledTimes(2));
    expect(useChatStore.getState().sseStatus).toBe("reconnecting");
  });

  it("refreshes active chat state after browser recovery reconnects", async () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveSession("sess-1");
    useChatStore.setState({ activeAgentId: "main" });

    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await vi.waitFor(() => expect(deckStream).toHaveBeenCalledTimes(2));
    const recoveryOptions = vi.mocked(deckStream).mock.calls[1]?.[1];

    await act(async () => {
      recoveryOptions?.onOpen?.();
    });

    await vi.waitFor(() => {
      expect(fetchSessionList).toHaveBeenCalledWith("main");
      expect(fetchChatSnapshot).toHaveBeenCalledWith({
        sessionKey: "sess-1",
        agentId: "main",
      });
    });
    expect(useChatStore.getState().sessionMetas[0]).toMatchObject({
      key: "sess-1",
      title: "Recovered",
    });
  });

  it("refreshes active chat state on the first post-recovery SSE event", async () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveSession("sess-1");
    useChatStore.setState({ activeAgentId: "main" });

    await act(async () => {
      root = createRoot(container);
      root.render(<HookHost />);
    });

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await vi.waitFor(() => expect(deckStream).toHaveBeenCalledTimes(2));
    const recoveryOptions = vi.mocked(deckStream).mock.calls[1]?.[1];

    act(() => {
      recoveryOptions?.onEvent?.({
        event: "chat",
        data: JSON.stringify({
          sessionKey: "sess-1",
          runId: "run-1",
          state: "delta",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "stream event" }],
            timestamp: 123,
          },
        }),
      });
    });

    await vi.waitFor(() => {
      expect(fetchSessionList).toHaveBeenCalledWith("main");
      expect(fetchChatSnapshot).toHaveBeenCalledWith({
        sessionKey: "sess-1",
        agentId: "main",
      });
    });
  });

  it("falls back to a controlled page reload when SSE stays reconnecting", async () => {
    vi.useFakeTimers();
    const replaceMock = vi.fn();
    const originalLocation = window.location;
    const replacementLocation = Object.create(originalLocation) as Location;
    Object.defineProperty(replacementLocation, "href", {
      configurable: true,
      value: originalLocation.href,
    });
    Object.defineProperty(replacementLocation, "replace", {
      configurable: true,
      value: replaceMock,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: replacementLocation,
    });

    try {
      await act(async () => {
        root = createRoot(container);
        root.render(<HookHost />);
      });

      const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
      act(() => {
        streamOptions?.onOpen?.();
        streamOptions?.onRetry?.();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(replaceMock).toHaveBeenCalledTimes(1);
      const redirectedUrl = new URL(String(replaceMock.mock.calls[0]?.[0]));
      expect(redirectedUrl.searchParams.get("__deck_recover")).toMatch(/^\d+$/);
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
      vi.useRealTimers();
    }
  });

  it("throttles controlled page reload recovery while cooldown is active", async () => {
    vi.useFakeTimers();
    const replaceMock = vi.fn();
    const originalLocation = window.location;
    const replacementLocation = Object.create(originalLocation) as Location;
    Object.defineProperty(replacementLocation, "href", {
      configurable: true,
      value: originalLocation.href,
    });
    Object.defineProperty(replacementLocation, "replace", {
      configurable: true,
      value: replaceMock,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: replacementLocation,
    });

    try {
      window.localStorage.setItem("deckGoStreamRecoveryReloadAt", `${Date.now()}`);

      await act(async () => {
        root = createRoot(container);
        root.render(<HookHost />);
      });

      const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
      act(() => {
        streamOptions?.onOpen?.();
        streamOptions?.onRetry?.();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(replaceMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
      vi.useRealTimers();
    }
  });
});
