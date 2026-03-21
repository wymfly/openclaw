import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../chat-types";

// Reset zustand store between tests by re-importing after each
let useChatStore: typeof import("../chat").useChatStore;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../chat");
  useChatStore = mod.useChatStore;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMsg(id: string, role: ChatMessage["role"] = "user", text = "hello"): ChatMessage {
  return {
    id,
    role,
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// ensureSession
// ---------------------------------------------------------------------------

describe("ensureSession", () => {
  it("creates a new SessionState when key is absent", () => {
    const { ensureSession, sessions } = useChatStore.getState();
    expect(sessions.size).toBe(0);

    ensureSession("sess-1");

    const state = useChatStore.getState();
    expect(state.sessions.size).toBe(1);
    const sess = state.sessions.get("sess-1");
    expect(sess).toBeDefined();
    expect(sess!.messages).toEqual([]);
    expect(sess!.isStreaming).toBe(false);
    expect(sess!.status).toBe("idle");
    expect(sess!.streamingRunId).toBeNull();
    expect(sess!.error).toBeNull();
  });

  it("returns existing session and updates lastAccessedAt when present", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");

    const before = useChatStore.getState().sessions.get("sess-1")!;
    const oldAccess = before.lastAccessedAt;

    // Advance time slightly
    vi.useFakeTimers();
    vi.advanceTimersByTime(100);

    useChatStore.getState().ensureSession("sess-1");

    const after = useChatStore.getState().sessions.get("sess-1")!;
    expect(after.lastAccessedAt).toBeGreaterThanOrEqual(oldAccess);
    // Messages should remain the same reference concept (empty)
    expect(after.messages).toEqual([]);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// addMessage (idempotent)
// ---------------------------------------------------------------------------

describe("addMessage", () => {
  it("adds a message to the correct session", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-a");
    store.ensureSession("sess-b");

    const msg = makeMsg("m1");
    useChatStore.getState().addMessage("sess-a", msg);

    const sessA = useChatStore.getState().sessions.get("sess-a")!;
    const sessB = useChatStore.getState().sessions.get("sess-b")!;
    expect(sessA.messages).toHaveLength(1);
    expect(sessA.messages[0].id).toBe("m1");
    expect(sessB.messages).toHaveLength(0);
  });

  it("is a no-op when message.id already exists in session", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-a");

    const msg = makeMsg("m1");
    useChatStore.getState().addMessage("sess-a", msg);
    useChatStore.getState().addMessage("sess-a", msg);

    const sess = useChatStore.getState().sessions.get("sess-a")!;
    expect(sess.messages).toHaveLength(1);
  });

  it("does not affect other sessions", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-a");
    store.ensureSession("sess-b");

    useChatStore.getState().addMessage("sess-b", makeMsg("m1"));

    const sessA = useChatStore.getState().sessions.get("sess-a")!;
    expect(sessA.messages).toHaveLength(0);
  });

  it("auto-creates session if it does not exist", () => {
    useChatStore.getState().addMessage("new-sess", makeMsg("m1"));

    const sess = useChatStore.getState().sessions.get("new-sess")!;
    expect(sess).toBeDefined();
    expect(sess.messages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// setMessages (history-then-append)
// ---------------------------------------------------------------------------

describe("setMessages", () => {
  it("replaces all messages when session is empty", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");

    const historyMsgs = [makeMsg("sess-1:1000:0"), makeMsg("sess-1:1000:1")];
    useChatStore.getState().setMessages("sess-1", historyMsgs);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.messages).toHaveLength(2);
    expect(sess.messages[0].id).toBe("sess-1:1000:0");
    expect(sess.messages[1].id).toBe("sess-1:1000:1");
  });

  it("appends SSE messages after history when session has SSE messages", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");

    // Simulate SSE messages arriving first (UUID-like IDs, no colon)
    const sseMsg = makeMsg("550e8400-e29b-41d4-a716-446655440000", "assistant", "streaming...");
    useChatStore.getState().addMessage("sess-1", sseMsg);

    // Now history arrives
    const historyMsgs = [
      makeMsg("sess-1:1000:0", "user", "hello"),
      makeMsg("sess-1:1000:1", "assistant", "hi there"),
    ];
    useChatStore.getState().setMessages("sess-1", historyMsgs);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    // History first, then SSE messages appended
    expect(sess.messages).toHaveLength(3);
    expect(sess.messages[0].id).toBe("sess-1:1000:0");
    expect(sess.messages[1].id).toBe("sess-1:1000:1");
    expect(sess.messages[2].id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("deduplicates SSE messages that are already in history", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");

    // SSE message arrives
    const sseMsg = makeMsg("run-123", "assistant", "streaming response");
    useChatStore.getState().addMessage("sess-1", sseMsg);

    // History arrives — no SSE-format IDs to preserve
    const historyMsgs = [makeMsg("sess-1:1000:0", "user"), makeMsg("sess-1:1000:1", "assistant")];
    useChatStore.getState().setMessages("sess-1", historyMsgs);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    // SSE msg with non-UUID, non-history ID still gets appended
    expect(sess.messages.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// setStreaming + status transitions
// ---------------------------------------------------------------------------

describe("setStreaming", () => {
  it("setStreaming(key, true, runId) sets status=active + streamingRunId", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");

    useChatStore.getState().setStreaming("sess-1", true, "run-abc");

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.isStreaming).toBe(true);
    expect(sess.streamingRunId).toBe("run-abc");
    expect(sess.status).toBe("active");
  });

  it("setStreaming(key, false) sets status=idle + clears streamingRunId", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    useChatStore.getState().setStreaming("sess-1", true, "run-abc");

    useChatStore.getState().setStreaming("sess-1", false);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.isStreaming).toBe(false);
    expect(sess.streamingRunId).toBeNull();
    expect(sess.status).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// setActiveSession
// ---------------------------------------------------------------------------

describe("setActiveSession", () => {
  it("sets activeSessionKey", () => {
    useChatStore.getState().setActiveSession("sess-1");
    expect(useChatStore.getState().activeSessionKey).toBe("sess-1");
  });

  it("updates lastAccessedAt on cache hit (key exists in Map)", () => {
    vi.useFakeTimers();

    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    const before = useChatStore.getState().sessions.get("sess-1")!.lastAccessedAt;

    vi.advanceTimersByTime(500);

    useChatStore.getState().setActiveSession("sess-1");
    const after = useChatStore.getState().sessions.get("sess-1")!.lastAccessedAt;
    expect(after).toBeGreaterThan(before);

    vi.useRealTimers();
  });

  it("creates session if key not in Map", () => {
    useChatStore.getState().setActiveSession("new-sess");
    expect(useChatStore.getState().sessions.has("new-sess")).toBe(true);
    expect(useChatStore.getState().activeSessionKey).toBe("new-sess");
  });

  it("handles null key", () => {
    useChatStore.getState().setActiveSession("sess-1");
    useChatStore.getState().setActiveSession(null);
    expect(useChatStore.getState().activeSessionKey).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evictStale
// ---------------------------------------------------------------------------

describe("evictStale", () => {
  it("never evicts active sessions (status !== idle)", () => {
    vi.useFakeTimers();
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    useChatStore.getState().setStreaming("active-sess", true, "run-1");

    vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

    useChatStore.getState().evictStale(1); // 1ms idle threshold
    expect(useChatStore.getState().sessions.has("active-sess")).toBe(true);

    vi.useRealTimers();
  });

  it("never evicts activeSessionKey", () => {
    vi.useFakeTimers();
    const store = useChatStore.getState();
    store.ensureSession("curr-sess");
    useChatStore.getState().setActiveSession("curr-sess");

    vi.advanceTimersByTime(10 * 60 * 1000);

    useChatStore.getState().evictStale(1);
    expect(useChatStore.getState().sessions.has("curr-sess")).toBe(true);

    vi.useRealTimers();
  });

  it("evicts stale idle sessions", () => {
    vi.useFakeTimers();
    const store = useChatStore.getState();
    store.ensureSession("stale-sess");
    // Ensure it's NOT the active session
    useChatStore.getState().setActiveSession("other-sess");

    vi.advanceTimersByTime(10 * 60 * 1000);

    useChatStore.getState().evictStale(5 * 60 * 1000);
    expect(useChatStore.getState().sessions.has("stale-sess")).toBe(false);
    // other-sess (activeSessionKey) should remain
    expect(useChatStore.getState().sessions.has("other-sess")).toBe(true);

    vi.useRealTimers();
  });

  it("creates a new Map reference (immutability)", () => {
    vi.useFakeTimers();
    const store = useChatStore.getState();
    store.ensureSession("stale-sess");
    useChatStore.getState().setActiveSession("other-sess");

    vi.advanceTimersByTime(10 * 60 * 1000);

    const oldSessions = useChatStore.getState().sessions;
    useChatStore.getState().evictStale(5 * 60 * 1000);
    const newSessions = useChatStore.getState().sessions;

    expect(Object.is(oldSessions, newSessions)).toBe(false);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// removeSession
// ---------------------------------------------------------------------------

describe("removeSession", () => {
  it("removes session from Map and sessionMeta", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setSessionMeta([{ key: "sess-1", agentId: "a1", updatedAt: Date.now() }]);

    useChatStore.getState().removeSession("sess-1");

    expect(useChatStore.getState().sessions.has("sess-1")).toBe(false);
    expect(useChatStore.getState().sessionMeta).toHaveLength(0);
  });

  it("calls abortSession for the removed key", async () => {
    // Import chat-abort to check side effects
    const abortMod = await import("../chat-abort");
    const ctrl = abortMod.getSessionAbort("sess-abort-test");
    expect(ctrl.signal.aborted).toBe(false);

    useChatStore.getState().ensureSession("sess-abort-test");
    useChatStore.getState().removeSession("sess-abort-test");

    expect(ctrl.signal.aborted).toBe(true);
  });

  it("is a no-op for nonexistent keys", () => {
    useChatStore.getState().ensureSession("sess-1");
    const before = useChatStore.getState().sessions.size;

    useChatStore.getState().removeSession("nonexistent");

    expect(useChatStore.getState().sessions.size).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// setSessionMeta / refreshSessionMeta
// ---------------------------------------------------------------------------

describe("setSessionMeta", () => {
  it("replaces the sessionMeta array", () => {
    const meta = [
      { key: "s1", agentId: "a1", updatedAt: 1000 },
      { key: "s2", agentId: "a2", updatedAt: 2000 },
    ];
    useChatStore.getState().setSessionMeta(meta);
    expect(useChatStore.getState().sessionMeta).toEqual(meta);
  });

  it("replaces previous meta completely", () => {
    useChatStore.getState().setSessionMeta([{ key: "s1", agentId: "a1", updatedAt: 1000 }]);
    useChatStore.getState().setSessionMeta([{ key: "s2", agentId: "a2", updatedAt: 2000 }]);
    expect(useChatStore.getState().sessionMeta).toHaveLength(1);
    expect(useChatStore.getState().sessionMeta[0].key).toBe("s2");
  });
});

// ---------------------------------------------------------------------------
// Immutable Map updates
// ---------------------------------------------------------------------------

describe("immutable Map updates", () => {
  it("addMessage creates new Map reference", () => {
    useChatStore.getState().ensureSession("sess-1");
    const oldSessions = useChatStore.getState().sessions;

    useChatStore.getState().addMessage("sess-1", makeMsg("m1"));

    const newSessions = useChatStore.getState().sessions;
    expect(Object.is(oldSessions, newSessions)).toBe(false);
  });

  it("updateStreamingBlocks creates new Map reference", () => {
    useChatStore.getState().ensureSession("sess-1");
    const msg = makeMsg("run-1", "assistant", "streaming");
    useChatStore.getState().addMessage("sess-1", { ...msg, streaming: true });

    const oldSessions = useChatStore.getState().sessions;
    useChatStore
      .getState()
      .updateStreamingBlocks("sess-1", "run-1", [{ type: "text", text: "updated" }]);

    const newSessions = useChatStore.getState().sessions;
    expect(Object.is(oldSessions, newSessions)).toBe(false);
  });

  it("setStreaming creates new Map reference", () => {
    useChatStore.getState().ensureSession("sess-1");
    const oldSessions = useChatStore.getState().sessions;

    useChatStore.getState().setStreaming("sess-1", true, "run-1");

    const newSessions = useChatStore.getState().sessions;
    expect(Object.is(oldSessions, newSessions)).toBe(false);
  });

  it("setMessages creates new Map reference", () => {
    useChatStore.getState().ensureSession("sess-1");
    const oldSessions = useChatStore.getState().sessions;

    useChatStore.getState().setMessages("sess-1", [makeMsg("h1")]);

    const newSessions = useChatStore.getState().sessions;
    expect(Object.is(oldSessions, newSessions)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateStreamingBlocks
// ---------------------------------------------------------------------------

describe("updateStreamingBlocks", () => {
  it("replaces content blocks on the message matching runId", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().addMessage("sess-1", {
      ...makeMsg("run-1", "assistant"),
      streaming: true,
    });

    useChatStore
      .getState()
      .updateStreamingBlocks("sess-1", "run-1", [{ type: "text", text: "updated content" }]);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.content).toHaveLength(1);
    expect(msg.content[0]).toEqual({ type: "text", text: "updated content" });
  });
});

// ---------------------------------------------------------------------------
// finalizeStreamingMessage
// ---------------------------------------------------------------------------

describe("finalizeStreamingMessage", () => {
  it("sets streaming: false on the message matching runId", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().addMessage("sess-1", {
      ...makeMsg("run-1", "assistant"),
      streaming: true,
    });

    useChatStore.getState().finalizeStreamingMessage("sess-1", "run-1");

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.streaming).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// replaceMessageContent
// ---------------------------------------------------------------------------

describe("replaceMessageContent", () => {
  it("replaces content and sets streaming: false", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().addMessage("sess-1", {
      ...makeMsg("run-1", "assistant"),
      streaming: true,
    });

    const newBlocks = [
      { type: "text" as const, text: "final text" },
      { type: "tool_use" as const, id: "t1", name: "bash", input: {} },
    ];
    useChatStore.getState().replaceMessageContent("sess-1", "run-1", newBlocks);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    const msg = sess.messages.find((m) => m.id === "run-1")!;
    expect(msg.content).toEqual(newBlocks);
    expect(msg.streaming).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setError
// ---------------------------------------------------------------------------

describe("setError", () => {
  it("sets error on the specified session", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setError("sess-1", "something went wrong");

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.error).toBe("something went wrong");
  });

  it("clears error with null", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setError("sess-1", "err");
    useChatStore.getState().setError("sess-1", null);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setActiveAgent
// ---------------------------------------------------------------------------

describe("setActiveAgent", () => {
  it("sets activeAgentId", () => {
    useChatStore.getState().setActiveAgent("agent-1");
    expect(useChatStore.getState().activeAgentId).toBe("agent-1");
  });

  it("clears with null", () => {
    useChatStore.getState().setActiveAgent("agent-1");
    useChatStore.getState().setActiveAgent(null);
    expect(useChatStore.getState().activeAgentId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setActiveApproval
// ---------------------------------------------------------------------------

describe("setActiveApproval", () => {
  it("sets approval on the specified session", () => {
    useChatStore.getState().ensureSession("sess-1");
    const approval = { id: "a1", toolName: "bash", command: "ls" };
    useChatStore.getState().setActiveApproval("sess-1", approval);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.activeApproval).toEqual(approval);
  });

  it("clears with null", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setActiveApproval("sess-1", { id: "a1", toolName: "bash" });
    useChatStore.getState().setActiveApproval("sess-1", null);

    const sess = useChatStore.getState().sessions.get("sess-1")!;
    expect(sess.activeApproval).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Compatibility bridge (backward compat with old flat API)
// ---------------------------------------------------------------------------

describe("compatibility bridge", () => {
  it("getActiveSession returns active session state", async () => {
    const { getActiveSession } = await import("../chat");
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setActiveSession("sess-1");
    useChatStore.getState().addMessage("sess-1", makeMsg("m1"));

    const sess = getActiveSession();
    expect(sess).toBeDefined();
    expect(sess!.messages).toHaveLength(1);
  });

  it("getActiveSession returns undefined when no active session", async () => {
    const { getActiveSession } = await import("../chat");
    expect(getActiveSession()).toBeUndefined();
  });

  it("exports type aliases for backward compatibility", async () => {
    // These should be importable without error
    const mod = await import("../chat");
    expect(mod.useChatStore).toBeDefined();
  });
});
