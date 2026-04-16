import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/channels", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for channels.status", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost"));

    expect(gwRequest).toHaveBeenCalledWith("channels.status", { probe: false });
  });

  it("honors probe query params for wizard validation flows", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/channels?probe=true&timeoutMs=2500"));

    expect(gwRequest).toHaveBeenCalledWith("channels.status", {
      probe: true,
      timeoutMs: 2500,
    });
  });
});
