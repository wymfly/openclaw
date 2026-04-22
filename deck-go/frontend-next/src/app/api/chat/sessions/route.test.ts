import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/sessions", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to /api/sessions on deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            sessions: [
              {
                key: "session-1",
                agentId: "main",
                title: "Session 1",
                updatedAt: 123,
              },
            ],
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/chat/sessions?agentId=main"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/sessions",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessions: [
        {
          key: "session-1",
          agentId: "main",
          title: "Session 1",
          updatedAt: 123,
        },
      ],
    });
  });

  it("falls back to local handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { GET, DELETE } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/chat/sessions?agentId=main"));
    await DELETE(
      new NextRequest("http://localhost/api/chat/sessions", {
        method: "DELETE",
        body: JSON.stringify({ sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "sessions.list", {
      agentId: "main",
      includeDerivedTitles: true,
      includeLastMessage: true,
      limit: 50,
    });
    expect(gwRequest).toHaveBeenNthCalledWith(2, "sessions.delete", { key: "session-1" });
  });
});
