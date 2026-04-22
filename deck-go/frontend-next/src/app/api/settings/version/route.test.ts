import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/settings/version", () => {
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
      .mockResolvedValue(new Response(JSON.stringify({ deck: "1.0.0" }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/settings/version"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/settings/version",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
  });
});
