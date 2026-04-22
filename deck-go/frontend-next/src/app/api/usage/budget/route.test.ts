import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getBudgetRuleStore = vi.fn();

vi.mock("@server/budget-alert-stores", () => ({
  getBudgetRuleStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/usage/budget", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getBudgetRuleStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ rules: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/usage/budget"));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/usage/budget",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
  });

  it("proxies POST to Stage 2 budget routes when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: "br-1" }), { status: 201 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");
    const response = await POST(
      new NextRequest("http://localhost/api/usage/budget", {
        method: "POST",
        body: JSON.stringify({ name: "Budget", dimension: "cost" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/usage/budget",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(201);
  });

  it("falls back to local store handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const append = vi.fn();
    getBudgetRuleStore.mockReturnValue({
      get: () => [],
      append,
    });
    const { GET, POST } = await import("./route.js");
    const getResponse = await GET(new NextRequest("http://localhost/api/usage/budget"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/usage/budget", {
        method: "POST",
        body: JSON.stringify({ name: "Budget", dimension: "cost" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(201);
    expect(append).toHaveBeenCalledTimes(1);
  });
});
