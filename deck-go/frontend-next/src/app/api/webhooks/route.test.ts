import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getWebhookStore = vi.fn();

vi.mock("@/lib/webhooks", () => ({
  getWebhookStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/webhooks", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getWebhookStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ webhooks: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new Request("http://localhost/api/webhooks"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/webhooks",
      expect.objectContaining({ method: "GET" }),
    );
    expect(getWebhookStore).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local store handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const append = vi.fn();
    getWebhookStore.mockReturnValue({
      get: () => [],
      append,
    });
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new Request("http://localhost/api/webhooks"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/webhooks", {
        method: "POST",
        body: JSON.stringify({ name: "Audit", url: "https://example.com", events: [] }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(201);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it("proxies POST to Stage 2 webhooks when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: "wh-1" }), { status: 201 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks", {
        method: "POST",
        body: JSON.stringify({ name: "Audit", url: "https://example.com", events: [] }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/webhooks",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(201);
  });
});
