import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/commands", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gatewayRequest.mockReset();
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
            payload: { commands: [{ name: "/help" }] },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new Request("http://localhost/api/commands"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/commands",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gatewayRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ commands: [{ name: "/help" }] });
  });

  it("falls back to local gatewayRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gatewayRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { GET } = await import("./route.js");

    await GET(new Request("http://localhost/api/commands"));

    expect(gatewayRequest).toHaveBeenCalledWith("commands.list", {});
  });
});
