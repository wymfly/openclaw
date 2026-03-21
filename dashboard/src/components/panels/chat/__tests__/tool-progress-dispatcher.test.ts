import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chat";
import { dispatchAgentEvent } from "../useChatSSE";

describe("dispatchAgentEvent — toolProgress", () => {
  const SESSION = "agent:main:tp-test";

  beforeEach(() => {
    useChatStore.setState({
      sessions: new Map(),
      activeSessionKey: null,
      activeAgentId: null,
      sessionMeta: [],
    });
    useChatStore.getState().ensureSession(SESSION);
    useChatStore.getState().setStreaming(SESSION, true, "run-1");
    useChatStore.getState().addMessage(SESSION, {
      id: "run-1",
      role: "assistant",
      content: [{ type: "text", text: "thinking..." }],
      timestamp: Date.now(),
      streaming: true,
    });
  });

  it("creates toolProgress entry on phase=start", () => {
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash", toolCallId: "tc-1" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(session?.toolProgress["tc-1"]).toBeDefined();
    expect(session?.toolProgress["tc-1"].name).toBe("bash");
    expect(session?.toolProgress["tc-1"].status).toBe("running");
    expect(session?.toolProgress["tc-1"].startedAt).toBeGreaterThan(0);
  });

  it("updates toolProgress to completed on phase=result", () => {
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash", toolCallId: "tc-2" },
    });
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "result", name: "bash", toolCallId: "tc-2" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(session?.toolProgress["tc-2"].status).toBe("completed");
    expect(session?.toolProgress["tc-2"].completedAt).toBeGreaterThan(0);
  });

  it("updates toolProgress to error on phase=error", () => {
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash", toolCallId: "tc-3" },
    });
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "error", name: "bash", toolCallId: "tc-3" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(session?.toolProgress["tc-3"].status).toBe("error");
  });

  it("ignores events without toolCallId", () => {
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(Object.keys(session?.toolProgress ?? {})).toHaveLength(0);
  });
});
