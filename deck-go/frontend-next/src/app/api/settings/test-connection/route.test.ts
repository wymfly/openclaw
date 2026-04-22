import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/settings/test-connection", () => {
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
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/settings/test-connection", {
      method: "POST",
      body: JSON.stringify({ url: "ws://localhost:18789", token: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/settings/test-connection",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });
});
