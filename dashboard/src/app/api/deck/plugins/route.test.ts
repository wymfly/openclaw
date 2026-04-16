import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/deck/plugins", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("defaults to channel-capable inventory scope", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/deck/plugins"));

    expect(gwRequest).toHaveBeenCalledWith("deck.plugins.list", {});
  });

  it("passes through capability=all when requested", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/deck/plugins?capability=all"));

    expect(gwRequest).toHaveBeenCalledWith("deck.plugins.list", { capability: "all" });
  });
});
