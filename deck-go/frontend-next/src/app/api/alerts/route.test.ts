import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/alerts", () => {
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
      .mockResolvedValue(new Response(JSON.stringify({ rules: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new Request("http://localhost/api/alerts"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/alerts",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
  });

  it("proxies POST to Stage 2 alerts when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ rule: { id: "rule-1" } }), { status: 201 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          name: "High Usage",
          entityType: "usage",
          condition: ">=",
          threshold: 80,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/alerts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(201);
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new Request("http://localhost/api/alerts"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          name: "High Usage",
          entityType: "usage",
          condition: ">=",
          threshold: 80,
        }),
      }),
    );

    expect(getResponse.status).toBe(503);
    expect(await getResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
    expect(postResponse.status).toBe(503);
    expect(await postResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});
