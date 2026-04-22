import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let useChatStore: typeof import("@/stores/chat").useChatStore;
let reloadFullContent: typeof import("@/stores/chat-dispatchers").reloadFullContent;

beforeEach(async () => {
  vi.resetModules();
  ({ useChatStore } = await import("@/stores/chat"));
  ({ reloadFullContent } = await import("@/stores/chat-dispatchers"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("history seam guard", () => {
  it("reloadFullContent reads from /api/chat/history and never sessions.preview", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          messages: [{ role: "assistant", content: [{ type: "text", text: "ok" }] }],
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

    await reloadFullContent("sess-1", "run-1");

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : "";
    expect(requestUrl).toBe("/api/chat/history?sessionKey=sess-1&limit=5");
    expect(requestUrl).not.toContain("sessions.preview");
  });
});
