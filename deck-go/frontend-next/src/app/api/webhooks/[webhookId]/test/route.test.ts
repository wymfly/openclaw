import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getWebhookStore = vi.fn();
const deliverWebhook = vi.fn();

vi.mock("@/lib/webhooks", () => ({
  getWebhookStore,
  deliverWebhook,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/webhooks/[webhookId]/test", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getWebhookStore.mockReset();
    deliverWebhook.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/wh-1/test", { method: "POST" }),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/webhooks/wh-1/test",
      expect.objectContaining({ method: "POST" }),
    );
    expect(getWebhookStore).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local webhook delivery when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    getWebhookStore.mockReturnValue({
      find: vi.fn().mockReturnValue({ id: "wh-1", name: "Audit" }),
    });
    deliverWebhook.mockResolvedValueOnce({
      success: true,
      statusCode: 200,
      durationMs: 12,
      error: null,
      deliveryId: "wd-1",
    });
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/wh-1/test", { method: "POST" }),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );

    expect(response.status).toBe(200);
    expect(deliverWebhook).toHaveBeenCalledTimes(1);
  });
});
