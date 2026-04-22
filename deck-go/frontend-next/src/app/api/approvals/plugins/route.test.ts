import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRequest = vi.fn();
const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gatewayRequest,
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/approvals/plugins", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gatewayRequest.mockReset();
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([{ id: "plugin-ap-1" }]), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/approvals/plugins"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals/plugins",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gatewayRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "plugin-ap-1" }]);
  });

  it("falls back to local plugin approval handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gatewayRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET, POST } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/approvals/plugins"));
    await POST(
      new NextRequest("http://localhost/api/approvals/plugins", {
        method: "POST",
        body: JSON.stringify({ id: "plugin-ap-1", decision: "approve" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(gatewayRequest).toHaveBeenNthCalledWith(1, "plugin.approval.list", {});
    expect(gwRequest).toHaveBeenNthCalledWith(1, "plugin.approval.resolve", {
      id: "plugin-ap-1",
      decision: "approve",
    });
  });
});
