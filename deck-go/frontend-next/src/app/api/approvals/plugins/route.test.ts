import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/approvals/plugins", () => {
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
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "plugin-ap-1" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new NextRequest("http://localhost/api/approvals/plugins"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/approvals/plugins", {
        method: "POST",
        body: JSON.stringify({ id: "plugin-ap-1", decision: "approve" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals/plugins",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals/plugins/resolve",
      expect.objectContaining({ method: "POST" }),
    );
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual([{ id: "plugin-ap-1" }]);
    expect(postResponse.status).toBe(200);
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new NextRequest("http://localhost/api/approvals/plugins"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/approvals/plugins", {
        method: "POST",
        body: JSON.stringify({ id: "plugin-ap-1", decision: "approve" }),
        headers: { "Content-Type": "application/json" },
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
