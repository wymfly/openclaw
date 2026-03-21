import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../chat-types";

// ---------------------------------------------------------------------------
// Reset zustand store between tests by re-importing after each.
//
// Since these hooks are React hooks (they call useChatStore(selector)),
// we cannot invoke them directly in Node tests without a React environment.
// Instead we verify:
//   1. The module exports the expected functions (contract)
//   2. The selector logic produces correct results by applying it to store state
//   3. Cross-session isolation via Zustand subscribe()
// ---------------------------------------------------------------------------

let useChatStore: typeof import("../chat").useChatStore;
let hooks: typeof import("../chat-hooks");

beforeEach(async () => {
  vi.resetModules();
  const chatMod = await import("../chat");
  useChatStore = chatMod.useChatStore;
  hooks = await import("../chat-hooks");
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
// Module exports contract
// ---------------------------------------------------------------------------

describe("module exports", () => {
  it("exports all expected hook functions", () => {
    expect(typeof hooks.useSessionMessages).toBe("function");
    expect(typeof hooks.useSessionStreaming).toBe("function");
    expect(typeof hooks.useSessionToolProgress).toBe("function");
    expect(typeof hooks.useSessionApproval).toBe("function");
    expect(typeof hooks.useActiveSessionKey).toBe("function");
    expect(typeof hooks.useSessionMetaList).toBe("function");
    expect(typeof hooks.useSessionError).toBe("function");
    expect(typeof hooks.useSessionA2UI).toBe("function");
    expect(typeof hooks.useSessionIndicator).toBe("function");
  });

  it("exports SessionIndicator type (via runtime constant check)", () => {
    // SessionIndicator is a type — we verify it's used by useSessionIndicator
    // by checking the function exists (type assertion handled at compile time)
    expect(hooks.useSessionIndicator).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useSessionMessages
// ---------------------------------------------------------------------------

describe("useSessionMessages selector", () => {
  it("returns messages for the specified session", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().addMessage("sess-a", makeMsg("m1", "user", "hi"));

    const state = useChatStore.getState();
    const key = "sess-a";
    const result = state.sessions.get(key)?.messages ?? [];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("returns empty array for nonexistent session", () => {
    const state = useChatStore.getState();
    const result = state.sessions.get("nonexistent")?.messages ?? [];
    expect(result).toEqual([]);
  });

  it("falls back to activeSessionKey when no sessionKey provided", () => {
    useChatStore.getState().ensureSession("sess-active");
    useChatStore.getState().setActiveSession("sess-active");
    useChatStore.getState().addMessage("sess-active", makeMsg("m1"));

    const state = useChatStore.getState();
    const key = state.activeSessionKey;
    const result = key ? (state.sessions.get(key)?.messages ?? []) : [];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("does not return messages from a different session (cross-session isolation)", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");
    useChatStore.getState().addMessage("sess-a", makeMsg("m1-a", "user", "from A"));
    useChatStore.getState().addMessage("sess-b", makeMsg("m1-b", "user", "from B"));

    const messagesA = useChatStore.getState().sessions.get("sess-a")?.messages ?? [];
    expect(messagesA).toHaveLength(1);
    expect(messagesA[0].id).toBe("m1-a");

    // Modify session B — session A is unaffected
    useChatStore.getState().addMessage("sess-b", makeMsg("m2-b", "user", "more from B"));

    const messagesA2 = useChatStore.getState().sessions.get("sess-a")?.messages ?? [];
    expect(messagesA2).toHaveLength(1);
    expect(messagesA2[0].id).toBe("m1-a");
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useSessionStreaming
// ---------------------------------------------------------------------------

describe("useSessionStreaming selector", () => {
  it("returns isStreaming=false and runId=null for idle session", () => {
    useChatStore.getState().ensureSession("sess-1");

    const session = useChatStore.getState().sessions.get("sess-1");
    expect(session?.isStreaming ?? false).toBe(false);
    expect(session?.streamingRunId ?? null).toBeNull();
  });

  it("returns isStreaming=true and runId when streaming", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setStreaming("sess-1", true, "run-abc");

    const session = useChatStore.getState().sessions.get("sess-1");
    expect(session?.isStreaming).toBe(true);
    expect(session?.streamingRunId).toBe("run-abc");
  });

  it("falls back to activeSessionKey when no sessionKey provided", () => {
    useChatStore.getState().ensureSession("sess-active");
    useChatStore.getState().setActiveSession("sess-active");
    useChatStore.getState().setStreaming("sess-active", true, "run-xyz");

    const state = useChatStore.getState();
    const key = state.activeSessionKey;
    const session = key ? state.sessions.get(key) : undefined;
    expect(session?.isStreaming).toBe(true);
    expect(session?.streamingRunId).toBe("run-xyz");
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useSessionToolProgress
// ---------------------------------------------------------------------------

describe("useSessionToolProgress selector", () => {
  it("returns empty record for session with no tool progress", () => {
    useChatStore.getState().ensureSession("sess-1");

    const result = useChatStore.getState().sessions.get("sess-1")?.toolProgress ?? {};
    expect(result).toEqual({});
  });

  it("returns tool progress for session", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().updateToolProgress("sess-1", "tool-1", {
      toolUseId: "tool-1",
      name: "bash",
      status: "running",
      startedAt: 1000,
    });

    const result = useChatStore.getState().sessions.get("sess-1")?.toolProgress ?? {};
    expect(result["tool-1"]).toBeDefined();
    expect(result["tool-1"].name).toBe("bash");
    expect(result["tool-1"].status).toBe("running");
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useSessionApproval
// ---------------------------------------------------------------------------

describe("useSessionApproval selector", () => {
  it("returns null when no approval is active", () => {
    useChatStore.getState().ensureSession("sess-1");

    const result = useChatStore.getState().sessions.get("sess-1")?.activeApproval ?? null;
    expect(result).toBeNull();
  });

  it("returns the active approval request", () => {
    useChatStore.getState().ensureSession("sess-1");
    const approval = { id: "a1", toolName: "bash", command: "rm -rf" };
    useChatStore.getState().setActiveApproval("sess-1", approval);

    const result = useChatStore.getState().sessions.get("sess-1")?.activeApproval ?? null;
    expect(result).toEqual(approval);
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useActiveSessionKey
// ---------------------------------------------------------------------------

describe("useActiveSessionKey selector", () => {
  it("returns null when no session is active", () => {
    expect(useChatStore.getState().activeSessionKey).toBeNull();
  });

  it("returns the active session key", () => {
    useChatStore.getState().setActiveSession("sess-1");
    expect(useChatStore.getState().activeSessionKey).toBe("sess-1");
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useSessionMetaList
// ---------------------------------------------------------------------------

describe("useSessionMetaList selector", () => {
  it("returns empty array when no meta set", () => {
    expect(useChatStore.getState().sessionMeta).toEqual([]);
  });

  it("returns session meta list", () => {
    const meta = [
      { key: "s1", agentId: "a1", updatedAt: 1000 },
      { key: "s2", agentId: "a2", updatedAt: 2000 },
    ];
    useChatStore.getState().setSessionMeta(meta);
    expect(useChatStore.getState().sessionMeta).toEqual(meta);
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useSessionError
// ---------------------------------------------------------------------------

describe("useSessionError selector", () => {
  it("returns null when no error", () => {
    useChatStore.getState().ensureSession("sess-1");
    expect(useChatStore.getState().sessions.get("sess-1")?.error ?? null).toBeNull();
  });

  it("returns the session error", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setError("sess-1", "something broke");
    expect(useChatStore.getState().sessions.get("sess-1")?.error).toBe("something broke");
  });
});

// ---------------------------------------------------------------------------
// Selector logic: useSessionIndicator — priority: approval > streaming > canvas > idle > none
// ---------------------------------------------------------------------------

describe("useSessionIndicator selector", () => {
  // Helper that mirrors the hook's selector logic for direct testing
  function indicatorFor(key: string) {
    const session = useChatStore.getState().sessions.get(key);
    if (!session) {
      return "none" as const;
    }
    if (session.activeApproval) {
      return "approval" as const;
    }
    if (session.isStreaming) {
      return "streaming" as const;
    }
    if (session.a2uiState) {
      return "canvas" as const;
    }
    return "idle" as const;
  }

  it("returns 'none' for nonexistent session", () => {
    expect(indicatorFor("nonexistent")).toBe("none");
  });

  it("returns 'idle' for existing session with no activity", () => {
    useChatStore.getState().ensureSession("sess-1");
    expect(indicatorFor("sess-1")).toBe("idle");
  });

  it("returns 'streaming' when session is streaming", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setStreaming("sess-1", true, "run-1");
    expect(indicatorFor("sess-1")).toBe("streaming");
  });

  it("returns 'canvas' when A2UI state is set", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setA2UIState("sess-1", { url: "http://example.com", visible: true });
    expect(indicatorFor("sess-1")).toBe("canvas");
  });

  it("returns 'approval' when approval is active (highest priority)", () => {
    useChatStore.getState().ensureSession("sess-1");
    // Set ALL states — approval should still win
    useChatStore.getState().setStreaming("sess-1", true, "run-1");
    useChatStore.getState().setA2UIState("sess-1", { url: "http://example.com", visible: true });
    useChatStore.getState().setActiveApproval("sess-1", { id: "a1", toolName: "bash" });
    expect(indicatorFor("sess-1")).toBe("approval");
  });

  it("priority: streaming beats canvas when both set (but no approval)", () => {
    useChatStore.getState().ensureSession("sess-1");
    useChatStore.getState().setStreaming("sess-1", true, "run-1");
    useChatStore.getState().setA2UIState("sess-1", { url: "http://example.com", visible: true });
    expect(indicatorFor("sess-1")).toBe("streaming");
  });
});

// ---------------------------------------------------------------------------
// Cross-session isolation via Zustand subscribe()
// ---------------------------------------------------------------------------

describe("cross-session isolation via subscribe", () => {
  it("session A message selector is not triggered by session B mutations", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");
    useChatStore.getState().addMessage("sess-a", makeMsg("m1-a"));

    // Track how many times session A's messages change
    let changeCount = 0;
    let lastMessages: ChatMessage[] =
      useChatStore.getState().sessions.get("sess-a")?.messages ?? [];

    const unsub = useChatStore.subscribe((state) => {
      const current = state.sessions.get("sess-a")?.messages ?? [];
      // Only count if the actual array reference changed
      if (current !== lastMessages) {
        changeCount++;
        lastMessages = current;
      }
    });

    // Mutate session B only
    useChatStore.getState().addMessage("sess-b", makeMsg("m1-b"));
    useChatStore.getState().addMessage("sess-b", makeMsg("m2-b"));
    useChatStore.getState().setStreaming("sess-b", true, "run-b");
    useChatStore.getState().setError("sess-b", "error in B");

    // Session A messages array reference should NOT have changed
    expect(changeCount).toBe(0);

    // Verify session A data is intact
    const messagesA = useChatStore.getState().sessions.get("sess-a")?.messages ?? [];
    expect(messagesA).toHaveLength(1);
    expect(messagesA[0].id).toBe("m1-a");

    unsub();
  });

  it("useSessionIndicator for session A stays idle while session B changes state", () => {
    useChatStore.getState().ensureSession("sess-a");
    useChatStore.getState().ensureSession("sess-b");

    function indicatorFor(key: string) {
      const session = useChatStore.getState().sessions.get(key);
      if (!session) {
        return "none" as const;
      }
      if (session.activeApproval) {
        return "approval" as const;
      }
      if (session.isStreaming) {
        return "streaming" as const;
      }
      if (session.a2uiState) {
        return "canvas" as const;
      }
      return "idle" as const;
    }

    // Both start idle
    expect(indicatorFor("sess-a")).toBe("idle");
    expect(indicatorFor("sess-b")).toBe("idle");

    // Make session B streaming
    useChatStore.getState().setStreaming("sess-b", true, "run-b");
    expect(indicatorFor("sess-a")).toBe("idle");
    expect(indicatorFor("sess-b")).toBe("streaming");

    // Add approval to session B
    useChatStore.getState().setActiveApproval("sess-b", { id: "a1", toolName: "bash" });
    expect(indicatorFor("sess-a")).toBe("idle");
    expect(indicatorFor("sess-b")).toBe("approval");

    // Set A2UI on session B
    useChatStore.getState().setA2UIState("sess-b", { url: "http://x.com", visible: true });
    // Approval still wins for B
    expect(indicatorFor("sess-b")).toBe("approval");
    // A still idle
    expect(indicatorFor("sess-a")).toBe("idle");
  });
});
