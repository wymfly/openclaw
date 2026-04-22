import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/models/config", () => {
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
            payload: { raw: '{"models":{"providers":{}}}', hash: "h1" },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new Request("http://localhost/api/models/config") as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/models/config",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest for config.get", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(
      new Response(JSON.stringify({ raw: '{"models":{"providers":{}}}', hash: "h1" })),
    );
    const { GET } = await import("./route.js");

    await GET(new Request("http://localhost/api/models/config") as never);

    expect(gwRequest).toHaveBeenCalledWith("config.get", {});
  });

  it("proxies PATCH to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { PATCH } = await import("./route.js");

    const response = await PATCH(
      new Request("http://localhost/api/models/config", {
        method: "PATCH",
        body: JSON.stringify({ raw: '{"models":{"providers":{"openai":{}}}}', baseHash: "h1" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/models/config",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest for config.patch", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { PATCH } = await import("./route.js");

    await PATCH(
      new Request("http://localhost/api/models/config", {
        method: "PATCH",
        body: JSON.stringify({ raw: '{"models":{"providers":{"openai":{}}}}', baseHash: "h1" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
    );

    expect(gwRequest).toHaveBeenCalledWith("config.patch", {
      raw: '{"models":{"providers":{"openai":{}}}}',
      baseHash: "h1",
    });
  });
});
