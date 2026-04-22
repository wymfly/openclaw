import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/projection", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
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
    const res = await POST(
      new NextRequest("http://localhost/api/chat/projection", {
        method: "POST",
        body: JSON.stringify({ sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/chat/projection",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res.status).toBe(200);
  });

  it("falls back to local no-op when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { POST } = await import("./route.js");
    const res = await POST(
      new NextRequest("http://localhost/api/chat/projection", {
        method: "POST",
        body: JSON.stringify({ sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const payload = await res.json();
    expect(payload.ok).toBe(true);
  });
});
