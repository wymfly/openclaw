import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/channels/[channelId]/logout", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for channels.logout", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(new NextRequest("http://localhost/api/channels/telegram/logout"), {
      params: Promise.resolve({ channelId: "telegram" }),
    });

    expect(gwRequest).toHaveBeenCalledWith("channels.logout", { channel: "telegram" });
  });
});
