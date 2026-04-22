import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/nodes/pair", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
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
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ requests: [{ pairingCode: "pair-1" }] });
  });

  it("falls back to local gwRequest handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { GET, POST } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/nodes/pair"));
    await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "request", pairingCode: "pair-1" }),
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "approve", pairingCode: "pair-1" }),
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "reject", pairingCode: "pair-1" }),
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/nodes/pair", {
        method: "POST",
        body: JSON.stringify({ action: "verify", pairingCode: "pair-1" }),
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "node.pair.list", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "node.pair.request", { pairingCode: "pair-1" });
    expect(gwRequest).toHaveBeenNthCalledWith(3, "node.pair.approve", { pairingCode: "pair-1" });
    expect(gwRequest).toHaveBeenNthCalledWith(4, "node.pair.reject", { pairingCode: "pair-1" });
    expect(gwRequest).toHaveBeenNthCalledWith(5, "node.pair.verify", { pairingCode: "pair-1" });
  });
});
