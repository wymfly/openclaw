import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/gateway/status", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gatewayRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            status: {
              sessions: 1,
              channels: { discord: "connected" },
              heartbeat: "ok",
              state: "active",
            },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/gateway/status"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/gateway/status",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gatewayRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessions: 1,
      channels: { discord: "connected" },
      heartbeat: "ok",
      state: "active",
    });
  });

  it("uses typed gatewayRequest for status", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gatewayRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/gateway/status"));

    expect(gatewayRequest).toHaveBeenCalledWith("status", {});
  });
});
