import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDeliveryStore = vi.fn();

vi.mock("@/lib/webhooks", () => ({
  getDeliveryStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/webhooks/[webhookId]/deliveries", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getDeliveryStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ deliveries: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/webhooks/wh-1/deliveries"),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/webhooks/wh-1/deliveries",
      expect.objectContaining({ method: "GET" }),
    );
    expect(getDeliveryStore).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local delivery store when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    getDeliveryStore.mockReturnValue({
      get: () => [{ webhookId: "wh-1", createdAt: "2026-04-20T00:00:00Z" }],
    });
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/webhooks/wh-1/deliveries"),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );

    expect(response.status).toBe(200);
  });
});
