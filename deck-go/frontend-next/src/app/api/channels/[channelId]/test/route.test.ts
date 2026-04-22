import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/channels/[channelId]/test", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const { POST } = await import("./route.js");
    const res = await POST(
      new NextRequest("http://localhost/api/channels/telegram/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ channelId: "telegram" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/channels/telegram/test",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { POST } = await import("./route.js");

    const res = await POST(
      new NextRequest("http://localhost/api/channels/telegram/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ channelId: "telegram" }) },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});
