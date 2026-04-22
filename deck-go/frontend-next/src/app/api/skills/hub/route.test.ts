import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/skills/hub", () => {
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

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "search", query: "tool" }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/skills/hub",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "search", query: "tool", limit: 5 }),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });

  it("keeps thin validation for invalid or incomplete hub actions", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { POST } = await import("./route.js");

    const invalidAction = await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "bogus" }),
      }),
    );
    const missingSlug = await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "detail" }),
      }),
    );

    expect(invalidAction.status).toBe(400);
    expect(await invalidAction.json()).toEqual({ error: 'unknown action "bogus"' });
    expect(missingSlug.status).toBe(400);
    expect(await missingSlug.json()).toEqual({ error: "slug is required" });
  });
});
