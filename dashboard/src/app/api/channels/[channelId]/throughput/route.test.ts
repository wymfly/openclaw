import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/channels/[channelId]/throughput", () => {
  it("returns a stable empty dataset until an authoritative throughput source exists", async () => {
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
