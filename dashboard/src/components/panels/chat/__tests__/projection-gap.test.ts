import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock chat-api and history-normalize before any imports
vi.mock("../chat-api", () => ({
  fetchChatSnapshot: vi.fn(),
  persistChatProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../history-normalize", () => ({
  normalizeHistoryMessages: vi.fn((sessionKey: string, msgs: unknown[]) =>
    msgs.map((m, i) => ({
      id: `${sessionKey}:0:${i}`,
      role: (m as { role?: string }).role ?? "user",
      content: [{ type: "text", text: "normalized" }],
      timestamp: Date.now(),
    })),
  ),
}));

// Dynamic imports — re-acquired after each vi.resetModules() so mock
// instances stay in sync with the modules the code under test uses.
let fetchChatSnapshot: typeof import("../chat-api").fetchChatSnapshot;
let normalizeHistoryMessages: typeof import("../history-normalize").normalizeHistoryMessages;
let handleProjectionGap: typeof import("../useChatSSE").handleProjectionGap;
let useChatStore: typeof import("@/stores/chat").useChatStore;

beforeEach(async () => {
  vi.resetModules();
  ({ fetchChatSnapshot } = await import("../chat-api"));
  ({ normalizeHistoryMessages } = await import("../history-normalize"));
  ({ handleProjectionGap } = await import("../useChatSSE"));
  ({ useChatStore } = await import("@/stores/chat"));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("handleProjectionGap", () => {
  it("evicts stale sessions and refetches active session snapshot", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.ensureSession("stale-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    vi.mocked(fetchChatSnapshot).mockResolvedValue({
      messages: [{ role: "assistant", content: "hello", timestamp: 1000 }],
      meta: null,
      activeApproval: null,
      a2uiState: null,
    });

    const evictSpy = vi.spyOn(useChatStore.getState(), "evictStale");

    await handleProjectionGap();

    expect(evictSpy).toHaveBeenCalledWith(0);
    expect(fetchChatSnapshot).toHaveBeenCalledWith({
      sessionKey: "active-sess",
      agentId: "main",
    });
    expect(normalizeHistoryMessages).toHaveBeenCalledWith("active-sess", expect.any(Array));
  });

  it("is a safe no-op when no active session", async () => {
    // No active session set
    await handleProjectionGap();

    expect(fetchChatSnapshot).not.toHaveBeenCalled();
  });

  it("does not interrupt streaming sessions", async () => {
    const store = useChatStore.getState();
    store.ensureSession("streaming-sess");
    store.setStreaming("streaming-sess", true, "run-1");
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    vi.mocked(fetchChatSnapshot).mockResolvedValue({
      messages: [],
      meta: null,
      activeApproval: null,
      a2uiState: null,
    });

    await handleProjectionGap();

    // Streaming session should survive eviction
    expect(useChatStore.getState().sessions.has("streaming-sess")).toBe(true);
    expect(useChatStore.getState().sessions.get("streaming-sess")?.isStreaming).toBe(true);
  });

  it("applies approval and a2uiState from snapshot", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    const mockApproval = {
      sessionKey: "active-sess",
      id: "approval-1",
      toolName: "command",
    };
    const mockA2UI = { visible: true, url: "http://localhost:3001" };

    vi.mocked(fetchChatSnapshot).mockResolvedValue({
      messages: [],
      meta: null,
      activeApproval: mockApproval,
      a2uiState: mockA2UI,
    });

    await handleProjectionGap();

    const session = useChatStore.getState().sessions.get("active-sess");
    expect(session?.activeApproval).toEqual(mockApproval);
    expect(session?.a2uiState).toMatchObject({ visible: true, url: "http://localhost:3001" });
  });

  it("handles snapshot fetch failure gracefully", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    vi.mocked(fetchChatSnapshot).mockRejectedValue(new Error("Network error"));

    // Should not throw
    await expect(handleProjectionGap()).resolves.toBeUndefined();
  });

  it("coalesces concurrent gap calls via in-flight guard", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    // Create a deferred promise so we can control resolution timing
    let resolve!: (v: unknown) => void;
    const deferred = new Promise((r) => {
      resolve = r;
    });
    vi.mocked(fetchChatSnapshot).mockReturnValue(deferred as ReturnType<typeof fetchChatSnapshot>);

    // Fire two concurrent calls
    const p1 = handleProjectionGap();
    const p2 = handleProjectionGap();

    // Second call should return immediately (in-flight guard)
    resolve({
      messages: [],
      meta: null,
      activeApproval: null,
      a2uiState: null,
    });
    await Promise.all([p1, p2]);

    // Only one fetch should have been made
    expect(fetchChatSnapshot).toHaveBeenCalledTimes(1);
  });
});
