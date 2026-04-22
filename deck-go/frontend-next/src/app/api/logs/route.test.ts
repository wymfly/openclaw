import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/logs", () => {
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
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/logs?cursor=10&limit=25&maxBytes=5000");

    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/logs?cursor=10&limit=25&maxBytes=5000",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gatewayRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("uses typed gwRequest for logs.tail", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gatewayRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/logs?cursor=10&limit=25&maxBytes=5000");

    await GET(request);

    expect(gatewayRequest).toHaveBeenCalledWith("logs.tail", {
      cursor: 10,
      limit: 25,
      maxBytes: 5000,
    });
  });
});
