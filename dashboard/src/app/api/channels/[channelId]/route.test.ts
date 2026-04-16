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
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("reads baseHash then sends only the channel subtree patch via config.patch", async () => {
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
