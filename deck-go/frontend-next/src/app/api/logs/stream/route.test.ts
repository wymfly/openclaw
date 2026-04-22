import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/logs/stream", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("event: log.batch\ndata: {}\n\n", { status: 200 }));
    globalThis.fetch = fetchMock;

    const { GET } = await import("./route.js");
    const request = new Request("http://localhost/api/logs/stream", {
      headers: {
        "x-deck-token": "secret",
        "Last-Event-ID": "42",
      },
    });
    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/logs/stream",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    expect(response.status).toBe(200);
  });
});
