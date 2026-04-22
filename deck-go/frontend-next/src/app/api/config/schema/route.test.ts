import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/config/schema", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
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
            schema: { type: "object" },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/config/schema"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/config/schema",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ type: "object" });
  });

  it("uses typed gwRequest for config.schema", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost"));

    expect(gwRequest).toHaveBeenCalledWith("config.schema", {});
  });
});
