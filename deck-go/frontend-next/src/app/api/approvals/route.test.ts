import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/approvals", () => {
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

  it("proxies GET and POST to stage2 when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            payload: { path: "approvals.json", exists: true, hash: "h1" },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new NextRequest("http://localhost/api/approvals"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id: "ap-1", decision: "approve" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals/resolve",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await getResponse.json()).toEqual({ path: "approvals.json", exists: true, hash: "h1" });
    expect(postResponse.status).toBe(200);
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new NextRequest("http://localhost"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id: "ap-1", decision: "approve" }),
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
