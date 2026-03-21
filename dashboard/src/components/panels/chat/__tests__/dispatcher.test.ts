import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// We reset the zustand store between tests by re-importing the module.
// The dispatcher functions are standalone (not hooks), so they can be
// called directly in tests.
// ---------------------------------------------------------------------------

let useChatStore: typeof import("@/stores/chat").useChatStore;
let dispatchChatEvent: typeof import("../useChatSSE").dispatchChatEvent;
let dispatchAgentEvent: typeof import("../useChatSSE").dispatchAgentEvent;
let dispatchApproval: typeof import("../useChatSSE").dispatchApproval;
let dispatchApprovalResolved: typeof import("../useChatSSE").dispatchApprovalResolved;
let dispatchA2UIEvent: typeof import("../useChatSSE").dispatchA2UIEvent;
let reloadFullContent: typeof import("../useChatSSE").reloadFullContent;

beforeEach(async () => {
  vi.resetModules();
  const storeMod = await import("@/stores/chat");
  useChatStore = storeMod.useChatStore;
  const dispatcherMod = await import("../useChatSSE");
  dispatchChatEvent = dispatcherMod.dispatchChatEvent;
  dispatchAgentEvent = dispatcherMod.dispatchAgentEvent;
  dispatchApproval = dispatcherMod.dispatchApproval;
  dispatchApprovalResolved = dispatcherMod.dispatchApprovalResolved;
  dispatchA2UIEvent = dispatcherMod.dispatchA2UIEvent;
  reloadFullContent = dispatcherMod.reloadFullContent;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Step 1: first-delta vs subsequent-delta
// ---------------------------------------------------------------------------

describe("dispatchChatEvent — delta events", () => {
  it("first delta (streamingRunId !== runId) calls addMessage + setStreaming", () => {
    useChatStore.getState().ensureSession("sess-1");

    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.messages).toHaveLength(1);
    expect(sess.messages[0].id).toBe("run-1");
    expect(sess.messages[0].role).toBe("assistant");
    expect(sess.messages[0].content).toEqual([{ type: "text", text: "Hello" }]);
    expect(sess.messages[0].streaming).toBe(true);
    expect(sess.isStreaming).toBe(true);
    expect(sess.streamingRunId).toBe("run-1");
  });

  it("subsequent delta (streamingRunId === runId) calls updateStreamingBlocks", () => {
    useChatStore.getState().ensureSession("sess-1");

    // First delta
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hel" }],
      },
    });

    // Subsequent delta — full accumulated text, not incremental
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 1,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello world" }],
      },
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    // Should still be 1 message (updated, not added again)
    expect(sess.messages).toHaveLength(1);
    expect(sess.messages[0].content).toEqual([{ type: "text", text: "Hello world" }]);
  });

  it("ignores events with no sessionKey", () => {
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "ignored" }],
      },
    });

    expect(useChatStore.getState().sessions.size).toBe(0);
  });

  it("auto-creates session via ensureSession if it does not exist", () => {
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "new-sess",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "auto" }],
      },
    });

    expect(useChatStore.getState().sessions.has("new-sess")).toBe(true);
    const sess = useChatStore.getState().sessions.get("new-sess")!;
    expect(sess.messages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Step 2: final triggers reloadFullContent
// ---------------------------------------------------------------------------

describe("dispatchChatEvent — final event", () => {
  it("finalizes streaming message and sets streaming false", () => {
    // Suppress the fire-and-forget reloadFullContent fetch
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    );

    useChatStore.getState().ensureSession("sess-1");

    // First delta
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "streaming..." }],
      },
    });

    // Final
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 1,
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "final text" }],
      },
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.isStreaming).toBe(false);
    expect(sess.streamingRunId).toBeNull();
    // Message should be finalized
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.streaming).toBe(false);
    expect(msg.content).toEqual([{ type: "text", text: "final text" }]);
  });

  it("calls reloadFullContent with correct sessionKey and runId", async () => {
    // Mock fetch to verify reloadFullContent is called
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          messages: [
            {
              role: "assistant",
              content: [
                { type: "text", text: "full content" },
                { type: "tool_use", id: "t1", name: "bash", input: {} },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    useChatStore.getState().ensureSession("sess-1");

    // First delta
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "partial" }],
      },
    });

    // Final
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 1,
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "done" }],
      },
    });

    // Wait for reloadFullContent to complete
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Verify fetch was called with correct params
    const fetchUrl = fetchSpy.mock.calls[0][0] as string;
    expect(fetchUrl).toContain("sessionKey=sess-1");
    expect(fetchUrl).toContain("limit=5");
  });

  it("handles final without preceding delta (command response)", () => {
    useChatStore.getState().ensureSession("sess-1");

    // Suppress the reloadFullContent fetch
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    );

    dispatchChatEvent({
      runId: "run-cmd",
      sessionKey: "sess-1",
      seq: 0,
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "command response" }],
      },
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.messages).toHaveLength(1);
    expect(sess.messages[0].id).toBe("run-cmd");
    expect(sess.messages[0].content).toEqual([{ type: "text", text: "command response" }]);
    expect(sess.isStreaming).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// error + aborted events
// ---------------------------------------------------------------------------

describe("dispatchChatEvent — error event", () => {
  it("sets error on the session using payload.errorMessage", () => {
    useChatStore.getState().ensureSession("sess-1");

    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "error",
      errorMessage: "Something went wrong",
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.error).toBe("Something went wrong");
    expect(sess.isStreaming).toBe(false);
  });

  it("uses 'Unknown error' when errorMessage is missing", () => {
    useChatStore.getState().ensureSession("sess-1");

    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "error",
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.error).toBe("Unknown error");
  });

  it("finalizes streaming message on error", () => {
    useChatStore.getState().ensureSession("sess-1");

    // Start streaming
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "partial" }],
      },
    });

    // Error
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 1,
      state: "error",
      errorMessage: "oops",
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.streaming).toBe(false);
    expect(sess.isStreaming).toBe(false);
  });
});

describe("dispatchChatEvent — aborted event", () => {
  it("sets streaming false and finalizes streaming message", () => {
    useChatStore.getState().ensureSession("sess-1");

    // Start streaming
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "partial" }],
      },
    });

    // Aborted
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 1,
      state: "aborted",
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.isStreaming).toBe(false);
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.streaming).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Step 3: cross-session routing
// ---------------------------------------------------------------------------

describe("dispatchChatEvent — cross-session routing", () => {
  it("events for session A update session A, not session B", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");

    dispatchChatEvent({
      runId: "run-a",
      sessionKey: "sess-a",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "for session A" }],
      },
    });

    const sessA = useChatStore.getState().sessions.get("sess-a")!;
    const sessB = useChatStore.getState().sessions.get("sess-b")!;
    expect(sessA.messages).toHaveLength(1);
    expect(sessA.isStreaming).toBe(true);
    expect(sessB.messages).toHaveLength(0);
    expect(sessB.isStreaming).toBe(false);
  });

  it("events for session B update session B, not session A", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");

    dispatchChatEvent({
      runId: "run-b",
      sessionKey: "sess-b",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "for session B" }],
      },
    });

    const sessA = useChatStore.getState().sessions.get("sess-a")!;
    const sessB = useChatStore.getState().sessions.get("sess-b")!;
    expect(sessA.messages).toHaveLength(0);
    expect(sessB.messages).toHaveLength(1);
  });

  it("concurrent streaming in two sessions works independently", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");

    // Delta for session A
    dispatchChatEvent({
      runId: "run-a",
      sessionKey: "sess-a",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "streaming A" }],
      },
    });

    // Delta for session B
    dispatchChatEvent({
      runId: "run-b",
      sessionKey: "sess-b",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "streaming B" }],
      },
    });

    const sessA = useChatStore.getState().sessions.get("sess-a")!;
    const sessB = useChatStore.getState().sessions.get("sess-b")!;

    expect(sessA.messages).toHaveLength(1);
    expect(sessA.streamingRunId).toBe("run-a");
    expect(sessA.messages[0].content).toEqual([{ type: "text", text: "streaming A" }]);

    expect(sessB.messages).toHaveLength(1);
    expect(sessB.streamingRunId).toBe("run-b");
    expect(sessB.messages[0].content).toEqual([{ type: "text", text: "streaming B" }]);
  });
});

// ---------------------------------------------------------------------------
// Step 4: agent/approval/a2ui event routing
// ---------------------------------------------------------------------------

describe("dispatchAgentEvent", () => {
  it("routes tool start events to correct session's messages", () => {
    useChatStore.getState().ensureSession("sess-1");

    // Start streaming first
    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "thinking..." }],
      },
    });

    // Agent tool start event
    dispatchAgentEvent({
      sessionKey: "sess-1",
      stream: "tool",
      data: {
        phase: "start",
        name: "bash",
        toolCallId: "tc-1",
        args: { command: "ls" },
      },
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    // Should have text block + tool_use block appended
    expect(msg.content).toHaveLength(2);
    expect(msg.content[1]).toEqual({
      type: "tool_use",
      id: "tc-1",
      name: "bash",
      input: { command: "ls" },
    });
  });

  it("ignores non-start phases to avoid duplicate blocks", () => {
    useChatStore.getState().ensureSession("sess-1");

    dispatchChatEvent({
      runId: "run-1",
      sessionKey: "sess-1",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "thinking..." }],
      },
    });

    dispatchAgentEvent({
      sessionKey: "sess-1",
      stream: "tool",
      data: {
        phase: "update",
        name: "bash",
        toolCallId: "tc-1",
        args: {},
      },
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    // Only the original text block, no tool_use appended
    expect(msg.content).toHaveLength(1);
  });

  it("does not affect other sessions", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");

    // Stream in sess-a
    dispatchChatEvent({
      runId: "run-a",
      sessionKey: "sess-a",
      seq: 0,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "..." }],
      },
    });

    // Agent event for sess-a
    dispatchAgentEvent({
      sessionKey: "sess-a",
      stream: "tool",
      data: { phase: "start", name: "bash", toolCallId: "tc-1", args: {} },
    });

    const sessB = useChatStore.getState().sessions.get("sess-b")!;
    expect(sessB.messages).toHaveLength(0);
  });
});

describe("dispatchApproval", () => {
  it("routes approval to correct session", () => {
    useChatStore.getState().ensureSession("sess-1");

    dispatchApproval({
      sessionKey: "sess-1",
      id: "appr-1",
      toolName: "bash",
      command: "rm -rf /",
      description: "dangerous command",
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.activeApproval).toEqual({
      id: "appr-1",
      toolName: "bash",
      command: "rm -rf /",
      description: "dangerous command",
    });
  });

  it("does not affect other sessions", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");

    dispatchApproval({
      sessionKey: "sess-a",
      id: "appr-1",
      toolName: "bash",
    });

    const sessB = useChatStore.getState().sessions.get("sess-b")!;
    expect(sessB.activeApproval).toBeNull();
  });
});

describe("dispatchApprovalResolved", () => {
  it("clears active approval for the session", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setActiveApproval("sess-1", {
      id: "appr-1",
      toolName: "bash",
    });

    dispatchApprovalResolved({ sessionKey: "sess-1" });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.activeApproval).toBeNull();
  });
});

describe("dispatchA2UIEvent", () => {
  it("routes A2UI event to correct session and appends to event log", () => {
    useChatStore.getState().ensureSession("sess-1");

    dispatchA2UIEvent({
      sessionKey: "sess-1",
      surfaceUpdate: { surfaceId: "main", components: [{ id: "c1" }] },
    });

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    // Should auto-show the A2UI overlay
    expect(sess.a2uiState?.visible).toBe(true);
    // Should have appended an event
    expect(sess.a2uiState?.eventLog).toHaveLength(1);
    expect(sess.a2uiState?.eventLog?.[0].action).toBe("surfaceUpdate");
  });

  it("does not affect other sessions", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");

    dispatchA2UIEvent({
      sessionKey: "sess-a",
      surfaceUpdate: { surfaceId: "main", components: [] },
    });

    const sessB = useChatStore.getState().sessions.get("sess-b")!;
    expect(sessB.a2uiState).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reloadFullContent
// ---------------------------------------------------------------------------

describe("reloadFullContent", () => {
  it("fetches history and replaces message content with full blocks", async () => {
    const fullBlocks = [
      { type: "text", text: "final answer" },
      { type: "tool_use", id: "t1", name: "bash", input: { command: "ls" } },
      { type: "tool_result", tool_use_id: "t1", content: "file.txt" },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          messages: [
            { role: "user", content: [{ type: "text", text: "hello" }] },
            { role: "assistant", content: fullBlocks },
          ],
        }),
        { status: 200 },
      ),
    );

    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().addMessage("sess-1", {
      id: "run-1",
      role: "assistant",
      content: [{ type: "text", text: "streaming text" }],
      timestamp: Date.now(),
      streaming: false,
    });

    await reloadFullContent("sess-1", "run-1");

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    // Should have mapped blocks
    expect(msg.content.length).toBeGreaterThanOrEqual(2);
    expect(msg.content[0]).toEqual({ type: "text", text: "final answer" });
  });

  it("retries once on failure", async () => {
    // Use a custom fetch implementation to track calls precisely
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("network error");
      }
      return new Response(
        JSON.stringify({
          messages: [{ role: "assistant", content: [{ type: "text", text: "ok" }] }],
        }),
        { status: 200 },
      );
    });

    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().addMessage("sess-1", {
      id: "run-1",
      role: "assistant",
      content: [{ type: "text", text: "original" }],
      timestamp: Date.now(),
    });

    await reloadFullContent("sess-1", "run-1");

    // First call failed, second call succeeded — 2 calls total
    expect(callCount).toBe(2);
    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.content[0]).toEqual({ type: "text", text: "ok" });
  });

  it("keeps original content when both retries fail", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"));

    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().addMessage("sess-1", {
      id: "run-1",
      role: "assistant",
      content: [{ type: "text", text: "keep me" }],
      timestamp: Date.now(),
    });

    await reloadFullContent("sess-1", "run-1");

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.content[0]).toEqual({ type: "text", text: "keep me" });
  });

  it("skips replaceMessageContent if session was removed during fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          messages: [{ role: "assistant", content: [{ type: "text", text: "too late" }] }],
        }),
        { status: 200 },
      ),
    );

    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().addMessage("sess-1", {
      id: "run-1",
      role: "assistant",
      content: [{ type: "text", text: "original" }],
      timestamp: Date.now(),
    });

    // Remove session before fetch resolves — simulate by removing immediately
    // (the mock resolves synchronously in the microtask queue)
    const promise = reloadFullContent("sess-1", "run-1");
    useChatStore.getState().removeSession("sess-1");

    await promise;

    // Session was removed, so no crash
    expect(useChatStore.getState().sessions.has("sess-1")).toBe(false);
  });
});
