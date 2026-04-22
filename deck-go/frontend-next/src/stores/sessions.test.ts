// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionsStore } from "./sessions";

describe("sessions store transcript seam", () => {
  beforeEach(() => {
    useSessionsStore.setState({
      sessions: [],
      selectedKey: null,
      history: [],
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it("fetchHistory reads through /api/chat/history", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    );

    await useSessionsStore.getState().fetchHistory("agent:main:main");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/chat/history?sessionKey=agent%3Amain%3Amain",
      expect.any(Object),
    );
  });
});
