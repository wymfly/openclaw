import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const subscribeSessionMessages = vi.fn();
const unsubscribeSessionMessages = vi.fn();

vi.mock("@server/runtime", () => ({
  getRuntime: () => ({
    adapter: {
      subscribeSessionMessages,
      unsubscribeSessionMessages,
    },
  }),
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/session-events", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    subscribeSessionMessages.mockReset();
    unsubscribeSessionMessages.mockReset();
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
      new NextRequest("http://localhost/api/chat/session-events", {
        method: "POST",
        body: JSON.stringify({ action: "subscribe", sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/chat/session-events",
      expect.objectContaining({ method: "POST" }),
    );
    expect(subscribeSessionMessages).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local runtime adapter when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    subscribeSessionMessages.mockResolvedValueOnce(undefined);
    unsubscribeSessionMessages.mockResolvedValueOnce(undefined);
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/chat/session-events", {
        method: "POST",
        body: JSON.stringify({ action: "subscribe", sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/chat/session-events", {
        method: "POST",
        body: JSON.stringify({ action: "unsubscribe", sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(subscribeSessionMessages).toHaveBeenCalledWith("session-1");
    expect(unsubscribeSessionMessages).toHaveBeenCalledWith("session-1");
  });
});
