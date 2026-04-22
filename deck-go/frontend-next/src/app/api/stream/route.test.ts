import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/stream", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("event: ping\ndata: {}\n\n", { status: 200 }));
    globalThis.fetch = fetchMock;

    const { GET } = await import("./route.js");
    const response = await GET(
      new Request("http://localhost/api/stream", {
        headers: { "x-deck-token": "stream-secret", "Last-Event-ID": "40" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/stream",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");

    const response = await GET(new Request("http://localhost/api/stream"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});
