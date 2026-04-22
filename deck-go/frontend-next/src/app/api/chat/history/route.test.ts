import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/chat/history", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    }
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runtimeId: "rt_local",
          sessionId: "sess-1",
          timeline: [
            { id: "m1", role: "assistant" },
            { id: "m2", role: "assistant" },
            { id: "m3", role: "assistant" },
            { id: "m4", role: "assistant" },
            { id: "m5", role: "assistant" },
            { id: "m6", role: "assistant" },
          ],
          requestId: "req-1",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/history?sessionKey=sess-1&limit=5");

    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/sessions/sess-1/timeline",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      messages: [
        { id: "m2", role: "assistant" },
        { id: "m3", role: "assistant" },
        { id: "m4", role: "assistant" },
        { id: "m5", role: "assistant" },
        { id: "m6", role: "assistant" },
      ],
    });
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/history?sessionKey=sess-1&limit=5");

    const response = await GET(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});
