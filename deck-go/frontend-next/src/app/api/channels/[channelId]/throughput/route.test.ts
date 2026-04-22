import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/channels/[channelId]/throughput", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            channelId: "telegram",
            payload: { buckets: [], messagesIn: 0, messagesOut: 0 },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const res = await GET(new NextRequest("http://localhost/api/channels/telegram/throughput"), {
      params: Promise.resolve({ channelId: "telegram" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/channels/telegram/throughput",
      expect.objectContaining({ method: "GET" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      buckets: [],
      messagesIn: 0,
      messagesOut: 0,
    });
  });

  it("returns a stable empty dataset until an authoritative throughput source exists", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");

    const res = await GET(new NextRequest("http://localhost/api/channels/telegram/throughput"), {
      params: Promise.resolve({ channelId: "telegram" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      buckets: [],
      messagesIn: 0,
      messagesOut: 0,
    });
  });
});
