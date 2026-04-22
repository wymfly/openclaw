import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/cron", () => {
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
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/cron?limit=10&offset=5&query=nightly&enabled=true&sortBy=name&sortDir=asc&includeDisabled=true",
      ),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/cron?limit=10&offset=5&query=nightly&enabled=true&sortBy=name&sortDir=asc&includeDisabled=true",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest for cron.list", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(
      new NextRequest(
        "http://localhost/api/cron?limit=10&offset=5&query=nightly&enabled=true&sortBy=name&sortDir=asc&includeDisabled=true",
      ),
    );

    expect(gwRequest).toHaveBeenCalledWith("cron.list", {
      limit: 10,
      offset: 5,
      query: "nightly",
      enabled: "true",
      sortBy: "name",
      sortDir: "asc",
      includeDisabled: true,
    });
  });

  it("falls back to local gwRequest for cron.add", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/cron", {
        method: "POST",
        body: JSON.stringify({ name: "Nightly", enabled: true }),
      }),
    );

    expect(gwRequest).toHaveBeenCalledWith("cron.add", { name: "Nightly", enabled: true });
  });

  it("proxies POST to Stage 2 cron when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/cron", {
        method: "POST",
        body: JSON.stringify({ name: "Nightly", enabled: true }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/cron",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });
});
