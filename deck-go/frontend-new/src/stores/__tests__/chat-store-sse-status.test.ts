import { beforeEach, describe, expect, it, vi } from "vitest";

let useChatStore: typeof import("../chat").useChatStore;
let useSessionsStore: typeof import("../sessions").useSessionsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ useChatStore } = await import("../chat"));
  ({ useSessionsStore } = await import("../sessions"));
});

describe("SSE connection status", () => {
  it("defaults to disconnected", () => {
    expect(useChatStore.getState().sseStatus).toBe("disconnected");
  });

  it("transitions between connected, reconnecting, and disconnected", () => {
    const store = useChatStore.getState();

    store.setSSEStatus("connected");
    expect(useChatStore.getState().sseStatus).toBe("connected");

    store.setSSEStatus("reconnecting");
    expect(useChatStore.getState().sseStatus).toBe("reconnecting");

    store.setSSEStatus("disconnected");
    expect(useChatStore.getState().sseStatus).toBe("disconnected");
  });

  it("tracks session compaction counts from sessions.changed payloads", () => {
    const store = useSessionsStore.getState();

    store.applySessionChangedEvent({
      sessionKey: "sess-1",
      totalTokens: 120,
      contextTokens: 1_000,
      compactionCount: 2,
    });

    expect(useSessionsStore.getState().sessions[0]).toMatchObject({
      key: "sess-1",
      totalTokens: 120,
      contextTokens: 1_000,
      compactionCount: 2,
    });

    store.applySessionChangedEvent({
      sessionKey: "sess-1",
      compacted: true,
    });

    expect(useSessionsStore.getState().sessions[0]).toMatchObject({
      key: "sess-1",
      tokensIn: 0,
      tokensOut: 0,
      totalTokens: 0,
      compactionCount: 3,
    });
  });
});
