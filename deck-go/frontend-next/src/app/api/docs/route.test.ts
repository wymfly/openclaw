import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDocStore = vi.fn();

vi.mock("./store", () => ({
  getDocStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/docs", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getDocStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ docs: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/docs?q=test"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/docs?q=test",
      expect.objectContaining({ method: "GET" }),
    );
    expect(getDocStore).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local doc store when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    getDocStore.mockReturnValue({
      get: () => [{ id: "doc-1", title: "Spec", category: "spec", content: "hello", keywords: [], extractedAt: "2026-04-20T00:00:00Z" }],
    });
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/docs?q=spec"));

    expect(response.status).toBe(200);
  });
});
