import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwCall = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
}));

describe("/api/gateway/describe", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwCall.mockReset();
    vi.restoreAllMocks();
    vi.resetModules();
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
            describe: {
              methods: [{ name: "sessions.create" }],
              events: [{ name: "chat" }],
            },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;

    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/gateway/describe"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/gateway/describe?includeSchemas=true",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwCall).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      methods: [{ name: "sessions.create" }],
      events: [{ name: "chat" }],
    });
  });

  it("falls back to local gwCall when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwCall.mockResolvedValue({ ok: true });

    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/gateway/describe"));

    expect(gwCall).toHaveBeenCalledWith("gateway.describe", {
      filter: "all",
      includeSchemas: true,
    });
    expect(response.status).toBe(200);
  });
});
