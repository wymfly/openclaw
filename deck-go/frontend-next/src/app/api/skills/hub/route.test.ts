import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/skills/hub", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "search", query: "tool" }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/skills/hub",
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "search", query: "tool", limit: 5 }),
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "detail", slug: "test-skill" }),
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "install", slug: "test-skill", version: "1.0.0" }),
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "update" }),
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/skills/hub", {
        method: "POST",
        body: JSON.stringify({ action: "bins" }),
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "skills.search", { query: "tool", limit: 5 });
    expect(gwRequest).toHaveBeenNthCalledWith(2, "skills.detail", { slug: "test-skill" });
    expect(gwRequest).toHaveBeenNthCalledWith(3, "skills.install", {
      source: "clawhub",
      slug: "test-skill",
      version: "1.0.0",
    });
    expect(gwRequest).toHaveBeenNthCalledWith(4, "skills.update", {
      source: "clawhub",
      all: true,
    });
    expect(gwRequest).toHaveBeenNthCalledWith(5, "skills.bins", {});
  });
});
