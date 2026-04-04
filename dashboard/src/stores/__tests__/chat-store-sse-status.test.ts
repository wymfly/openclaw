import { beforeEach, describe, expect, it, vi } from "vitest";

let useChatStore: typeof import("../chat").useChatStore;

beforeEach(async () => {
  vi.resetModules();
  ({ useChatStore } = await import("../chat"));
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
});
