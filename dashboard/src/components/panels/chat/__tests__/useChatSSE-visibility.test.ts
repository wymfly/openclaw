// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EVICT_IDLE_MS } from "@/stores/chat-types";

// Mock deckStream to prevent actual SSE connection
vi.mock("@/lib/deck-client", () => ({
  deckStream: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  deckFetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
}));

// Mock chat-api to prevent actual API calls
vi.mock("../chat-api", () => ({
  fetchChatSnapshot: vi.fn(),
  persistChatProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../history-normalize", () => ({
  normalizeHistoryMessages: vi.fn(() => []),
}));

let useChatSSE: typeof import("../useChatSSE").useChatSSE;
let useChatStore: typeof import("@/stores/chat").useChatStore;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

beforeEach(async () => {
  vi.resetModules();
  ({ useChatSSE } = await import("../useChatSSE"));
  ({ useChatStore } = await import("@/stores/chat"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useChatSSE visibility eviction", () => {
  it("calls evictStale(DEFAULT_EVICT_IDLE_MS) when page goes hidden", () => {
    const spy = vi.spyOn(useChatStore.getState(), "evictStale");
    const { unmount } = renderHook(() => useChatSSE());

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(spy).toHaveBeenCalledWith(DEFAULT_EVICT_IDLE_MS);
    unmount();
  });

  it("does NOT call evictStale when page becomes visible", () => {
    const spy = vi.spyOn(useChatStore.getState(), "evictStale");
    const { unmount } = renderHook(() => useChatSSE());

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(spy).not.toHaveBeenCalled();
    unmount();
  });

  it("removes listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useChatSSE());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
