import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/channels/[channelId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const { PATCH } = await import("./route.js");

    const response = await PATCH(
      new NextRequest("http://localhost/api/channels/telegram", {
        method: "PATCH",
        body: JSON.stringify({ enabled: true }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ channelId: "telegram" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/channels/telegram",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("reads baseHash then sends only the channel subtree patch via config.patch", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            config: { channels: { telegram: { enabled: true } } },
            baseHash: "base-1",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const { PATCH } = await import("./route.js");

    await PATCH(
      new NextRequest("http://localhost/api/channels/telegram", {
        method: "PATCH",
        body: JSON.stringify({
          accounts: {
            main: {
              dm: { policy: "pairing" },
            },
          },
        }),
      }),
      { params: Promise.resolve({ channelId: "telegram" }) },
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "config.get", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "config.patch", {
      raw: JSON.stringify(
        {
          channels: {
            telegram: {
              accounts: {
                main: {
                  dm: { policy: "pairing" },
                },
              },
            },
          },
        },
        null,
        2,
      ),
      baseHash: "base-1",
    });
  });
});
