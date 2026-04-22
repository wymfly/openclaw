import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/chat/snapshot", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies to deck-go chat snapshot when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [{ id: "msg-1", role: "assistant", content: [{ type: "text", text: "hi" }] }],
          meta: { key: "session-1", agentId: "main" },
          activeApproval: { id: "approval-1" },
          a2uiState: null,
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/chat/snapshot?sessionKey=session-1&agentId=main&limit=25",
      ),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/chat/snapshot?sessionKey=session-1&agentId=main&limit=25",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      messages: [{ id: "msg-1", role: "assistant", content: [{ type: "text", text: "hi" }] }],
      meta: { key: "session-1", agentId: "main" },
      activeApproval: { id: "approval-1" },
      a2uiState: null,
    });
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/chat/snapshot?sessionKey=session-1"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});
