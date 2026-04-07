import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/channels/probe", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for probe=true channel status", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(new NextRequest("http://localhost"));

    expect(gwRequest).toHaveBeenCalledWith("channels.status", { probe: true });
  });
});
