import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ServerEvent } from "./event-bus";
import { classifyEvent, extractAgentId, RunEventPipeline } from "./run-event-pipeline";
import type { RunEventInput } from "./run-event-store";

// ---------------------------------------------------------------------------
// extractAgentId
// ---------------------------------------------------------------------------

describe("extractAgentId", () => {
  it("extracts agentId from agent:{id}:{rest} pattern", () => {
    expect(extractAgentId("agent:main:main")).toBe("main");
    expect(extractAgentId("agent:weather-bot:session-1")).toBe("weather-bot");
    expect(extractAgentId("agent:my-agent:subagent:child-1")).toBe("my-agent");
  });

  it("returns undefined for non-matching patterns", () => {
    expect(extractAgentId("user:123")).toBeUndefined();
    expect(extractAgentId("direct:chat")).toBeUndefined();
    expect(extractAgentId("")).toBeUndefined();
    expect(extractAgentId(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// classifyEvent — chat events
// ---------------------------------------------------------------------------

describe("classifyEvent — chat", () => {
  it("classifies chat final as model", () => {
    const payload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      seq: 10,
      state: "final",
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    expect(classifyEvent("chat", payload)).toBe("model");
  });

  it("classifies chat error as model", () => {
    const payload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      seq: 5,
      state: "error",
      errorMessage: "Rate limit exceeded",
    };
    expect(classifyEvent("chat", payload)).toBe("model");
  });

  it("skips chat delta (returns null)", () => {
    const payload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      seq: 3,
      state: "delta",
    };
    expect(classifyEvent("chat", payload)).toBeNull();
  });

  it("skips chat aborted (returns null)", () => {
    const payload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      seq: 7,
      state: "aborted",
    };
    expect(classifyEvent("chat", payload)).toBeNull();
  });

  it("returns null for chat events without runId", () => {
    const payload = {
      sessionKey: "agent:main:main",
      seq: 1,
      state: "final",
    };
    expect(classifyEvent("chat", payload)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classifyEvent — agent events
// ---------------------------------------------------------------------------

describe("classifyEvent — agent", () => {
  it("classifies agent tool stream as tool_call", () => {
    const payload = {
      runId: "run-1",
      seq: 2,
      stream: "tool",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start", name: "bash", toolCallId: "tc-1" },
    };
    expect(classifyEvent("agent", payload)).toBe("tool_call");
  });

  it("classifies file tool (write_file) as file_op", () => {
    const payload = {
      runId: "run-1",
      seq: 3,
      stream: "tool",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start", name: "write_file", toolCallId: "tc-2" },
    };
    expect(classifyEvent("agent", payload)).toBe("file_op");
  });

  it("classifies file tool (read_file) as file_op", () => {
    const payload = {
      runId: "run-1",
      seq: 4,
      stream: "tool",
      ts: Date.now(),
      data: { phase: "start", name: "read_file", toolCallId: "tc-3" },
    };
    expect(classifyEvent("agent", payload)).toBe("file_op");
  });

  it("classifies file tool (edit_file) as file_op", () => {
    const payload = {
      runId: "run-1",
      seq: 5,
      stream: "tool",
      ts: Date.now(),
      data: { phase: "start", name: "edit_file", toolCallId: "tc-4" },
    };
    expect(classifyEvent("agent", payload)).toBe("file_op");
  });

  it("classifies file tool (create_file) as file_op", () => {
    const payload = {
      runId: "run-1",
      seq: 6,
      stream: "tool",
      ts: Date.now(),
      data: { phase: "start", name: "create_file", toolCallId: "tc-5" },
    };
    expect(classifyEvent("agent", payload)).toBe("file_op");
  });

  it("classifies file tool (delete_file) as file_op", () => {
    const payload = {
      runId: "run-1",
      seq: 7,
      stream: "tool",
      ts: Date.now(),
      data: { phase: "start", name: "delete_file", toolCallId: "tc-6" },
    };
    expect(classifyEvent("agent", payload)).toBe("file_op");
  });

  it("classifies lifecycle events as system", () => {
    const payload = {
      runId: "run-1",
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start" },
    };
    expect(classifyEvent("agent", payload)).toBe("system");
  });

  it("classifies lifecycle with childRunId as subagent", () => {
    const payload = {
      runId: "run-1",
      seq: 8,
      stream: "lifecycle",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start", childRunId: "child-run-1" },
    };
    expect(classifyEvent("agent", payload)).toBe("subagent");
  });

  it("classifies lifecycle with childSessionKey as subagent", () => {
    const payload = {
      runId: "run-1",
      seq: 9,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start", childSessionKey: "agent:main:subagent:child-1" },
    };
    expect(classifyEvent("agent", payload)).toBe("subagent");
  });

  it("classifies agent error stream as system", () => {
    const payload = {
      runId: "run-1",
      seq: 10,
      stream: "error",
      ts: Date.now(),
      data: { message: "Something went wrong" },
    };
    expect(classifyEvent("agent", payload)).toBe("system");
  });

  it("classifies compaction stream as compaction", () => {
    const payload = {
      runId: "run-1",
      seq: 11,
      stream: "compaction",
      ts: Date.now(),
      data: { phase: "start" },
    };
    expect(classifyEvent("agent", payload)).toBe("compaction");
  });

  it("skips agent assistant stream (returns null)", () => {
    const payload = {
      runId: "run-1",
      seq: 12,
      stream: "assistant",
      ts: Date.now(),
      data: { text: "Hello" },
    };
    expect(classifyEvent("agent", payload)).toBeNull();
  });

  it("returns null for agent events without runId", () => {
    const payload = {
      seq: 1,
      stream: "tool",
      ts: Date.now(),
      data: { phase: "start", name: "bash", toolCallId: "tc-1" },
    };
    expect(classifyEvent("agent", payload)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RunEventPipeline — batching behavior
// ---------------------------------------------------------------------------

describe("RunEventPipeline", () => {
  let flushed: RunEventInput[][];
  let pipeline: RunEventPipeline;

  beforeEach(() => {
    vi.useFakeTimers();
    flushed = [];
    pipeline = new RunEventPipeline((events) => {
      flushed.push([...events]);
    });
  });

  afterEach(() => {
    pipeline.destroy();
    vi.useRealTimers();
  });

  function makeServerEvent(type: "chat" | "agent", data: unknown, id = 1): ServerEvent {
    return { id, type, data, timestamp: Date.now() };
  }

  it("buffers events and flushes on timer", () => {
    const event = makeServerEvent("chat", {
      runId: "run-1",
      sessionKey: "agent:main:main",
      seq: 1,
      state: "final",
    });

    pipeline.handleEvent(event);
    expect(flushed).toHaveLength(0);

    vi.advanceTimersByTime(500);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(1);
    expect(flushed[0][0].runId).toBe("run-1");
    expect(flushed[0][0].stream).toBe("model");
    expect(flushed[0][0].agentId).toBe("main");
  });

  it("flushes immediately when batch size (50) is reached", () => {
    for (let i = 0; i < 50; i++) {
      pipeline.handleEvent(
        makeServerEvent(
          "agent",
          {
            runId: "run-1",
            seq: i,
            stream: "tool",
            ts: Date.now(),
            data: { phase: "start", name: "bash", toolCallId: `tc-${i}` },
          },
          i + 1,
        ),
      );
    }

    // Should have flushed immediately at 50
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(50);
  });

  it("skips non-chat/agent events", () => {
    pipeline.handleEvent({
      id: 1,
      type: "runtime.status",
      data: { status: "connected" },
      timestamp: Date.now(),
    });

    vi.advanceTimersByTime(1000);
    expect(flushed).toHaveLength(0);
  });

  it("skips events classified as null (e.g., delta)", () => {
    pipeline.handleEvent(
      makeServerEvent("chat", {
        runId: "run-1",
        sessionKey: "agent:main:main",
        seq: 1,
        state: "delta",
      }),
    );

    vi.advanceTimersByTime(1000);
    expect(flushed).toHaveLength(0);
  });

  it("destroy() flushes remaining events", () => {
    pipeline.handleEvent(
      makeServerEvent("chat", {
        runId: "run-1",
        sessionKey: "agent:main:main",
        seq: 1,
        state: "final",
      }),
    );

    expect(flushed).toHaveLength(0);
    pipeline.destroy();
    expect(flushed).toHaveLength(1);
  });

  it("correctly serializes payload as JSON in data field", () => {
    const payload = {
      runId: "run-1",
      sessionKey: "agent:bot:session",
      seq: 5,
      state: "final",
      usage: { input_tokens: 200, output_tokens: 100 },
    };

    pipeline.handleEvent(makeServerEvent("chat", payload));
    vi.advanceTimersByTime(500);

    expect(flushed).toHaveLength(1);
    const stored = flushed[0][0];
    // Chat "final" events are normalized to { type: "result", subtype, usage }
    expect(stored.data).toBe(
      JSON.stringify({ type: "result", subtype: "success", usage: payload.usage }),
    );
    expect(stored.sessionKey).toBe("agent:bot:session");
    expect(stored.agentId).toBe("bot");
  });

  it("handles flush errors gracefully", () => {
    const errPipeline = new RunEventPipeline(() => {
      throw new Error("DB write failed");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errPipeline.handleEvent(
      makeServerEvent("chat", {
        runId: "run-1",
        sessionKey: "agent:main:main",
        seq: 1,
        state: "final",
      }),
    );

    // Should not throw
    expect(() => errPipeline.flush()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith("[RunEventPipeline] flush failed:", expect.any(Error));

    consoleSpy.mockRestore();
    errPipeline.destroy();
  });

  // -------------------------------------------------------------------------
  // Session events — Layer 2 bypass verification
  // -------------------------------------------------------------------------

  describe("session events (Layer 2 bypass)", () => {
    // Session events are routed directly to EventBus in gateway-adapter.ts,
    // so they arrive as "session-state"/"session-msg"/"session-tool" type.
    // RunEventPipeline should ignore them (not "chat" or "agent").

    it("skips session-state events", () => {
      pipeline.handleEvent({
        id: 100,
        type: "session-state" as ServerEvent["type"],
        data: { sessionKey: "agent:main:dashboard:123", reason: "send" },
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(1000);
      expect(flushed).toHaveLength(0);
    });

    it("skips session-msg events", () => {
      pipeline.handleEvent({
        id: 101,
        type: "session-msg" as ServerEvent["type"],
        data: { sessionKey: "agent:main:dashboard:123", message: {} },
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(1000);
      expect(flushed).toHaveLength(0);
    });

    it("skips session-tool events", () => {
      pipeline.handleEvent({
        id: 102,
        type: "session-tool" as ServerEvent["type"],
        data: { runId: "run-1", stream: "tool" },
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(1000);
      expect(flushed).toHaveLength(0);
    });
  });
});
