import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/gateway/status", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for status", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/gateway/status"));

    expect(gwRequest).toHaveBeenCalledWith("status", {});
  });
});
