import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/nodes/pair", () => {
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
          payload: { requests: [{ pairingCode: "pair-1" }] },
          requestId: "req-1",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/nodes/pair"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/nodes/pair",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ requests: [{ pairingCode: "pair-1" }] });
  });

  it("returns 503 for GET and POST when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new NextRequest("http://localhost/api/nodes/pair"));
    const requestResponse = await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "request", pairingCode: "pair-1" }),
      }),
    );
    const approveResponse = await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "approve", pairingCode: "pair-1" }),
      }),
    );
    const rejectResponse = await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "reject", pairingCode: "pair-1" }),
      }),
    );
    const verifyResponse = await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "verify", pairingCode: "pair-1" }),
      }),
    );

    for (const response of [
      getResponse,
      requestResponse,
      approveResponse,
      rejectResponse,
      verifyResponse,
    ]) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Deck Go control-plane API base not configured",
      });
    }
  });
});
