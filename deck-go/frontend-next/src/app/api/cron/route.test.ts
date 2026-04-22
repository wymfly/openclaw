import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/cron", () => {
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

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runtimeId: "rt_local",
          payload: { items: [{ id: "job-1" }] },
          requestId: "req-1",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/cron?limit=10&offset=5&query=nightly&enabled=true&sortBy=name&sortDir=asc&includeDisabled=true",
      ),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/cron?limit=10&offset=5&query=nightly&enabled=true&sortBy=name&sortDir=asc&includeDisabled=true",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [{ id: "job-1" }] });
  });

  it("returns 503 for GET when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/cron?limit=10&offset=5&query=nightly&enabled=true&sortBy=name&sortDir=asc&includeDisabled=true",
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });

  it("returns 503 for POST when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/cron", {
        method: "POST",
        body: JSON.stringify({ name: "Nightly", enabled: true }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });

  it("proxies POST to Stage 2 cron when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/cron", {
        method: "POST",
        body: JSON.stringify({ name: "Nightly", enabled: true }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/cron",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });
});
