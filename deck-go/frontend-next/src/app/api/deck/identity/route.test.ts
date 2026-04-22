import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/deck/identity", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ runtimeId: "rt_local", payload: { identities: [{ canonical: "user:1" }] } }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/deck/identity"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/deck/identity",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ identities: [{ canonical: "user:1" }] });
  });

  it("uses Stage 2 deck identity action route when deck-go base is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/deck/identity", {
        method: "POST",
        body: JSON.stringify({ action: "link", canonical: "user:1", channel: "telegram", peerId: "42" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/deck/identity",
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET, POST } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/deck/identity"));
    await POST(
      new NextRequest("http://localhost/api/deck/identity", {
        method: "POST",
        body: JSON.stringify({ action: "link", canonical: "user:1", channel: "telegram", peerId: "42" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "deck.identity.list", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "deck.identity.link", {
      canonical: "user:1",
      channel: "telegram",
      peerId: "42",
    });
  });
});
