import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/memory/search", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ error: "Not implemented — requires LanceDB extension" }), { status: 501 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/memory/search?q=test"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/memory/search?q=test",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(501);
  });

  it("falls back to local 501 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/memory/search?q=test"));
    expect(response.status).toBe(501);
  });
});
