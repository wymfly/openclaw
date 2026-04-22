import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();
const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/tools/catalog", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    gatewayRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            payload: { groups: [{ name: "default" }] },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/tools/catalog", {
      method: "POST",
      body: JSON.stringify({ agentId: "main", includePlugins: false }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/tools/catalog",
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ groups: [{ name: "default" }] });
  });

  it("falls back to local gatewayRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gatewayRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/tools/catalog", {
      method: "POST",
      body: JSON.stringify({ agentId: "main", includePlugins: false }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gatewayRequest).toHaveBeenCalledWith("tools.catalog", {
      agentId: "main",
      includePlugins: false,
    });
  });
});
