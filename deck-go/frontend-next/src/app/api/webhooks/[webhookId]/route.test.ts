import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getWebhookStore = vi.fn();

vi.mock("@/lib/webhooks", () => ({
  getWebhookStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/webhooks/[webhookId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getWebhookStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies PATCH to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: "wh-1" }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { PATCH } = await import("./route.js");

    const response = await PATCH(
      new NextRequest("http://localhost/api/webhooks/wh-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/webhooks/wh-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(getWebhookStore).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local store handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const updateItem = vi.fn();
    const removeWhere = vi.fn().mockReturnValue(1);
    getWebhookStore.mockReturnValue({
      find: vi.fn().mockReturnValue({ id: "wh-1", name: "Audit", url: "https://example.com" }),
      updateItem,
      removeWhere,
    });
    const { PATCH, DELETE } = await import("./route.js");

    const patchResponse = await PATCH(
      new NextRequest("http://localhost/api/webhooks/wh-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );
    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/webhooks/wh-1", { method: "DELETE" }),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(removeWhere).toHaveBeenCalledTimes(1);
  });

  it("proxies DELETE to Stage 2 webhooks when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { DELETE } = await import("./route.js");

    const response = await DELETE(
      new NextRequest("http://localhost/api/webhooks/wh-1", { method: "DELETE" }),
      { params: Promise.resolve({ webhookId: "wh-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/webhooks/wh-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
  });
});
