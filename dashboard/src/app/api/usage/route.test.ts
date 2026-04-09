import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/usage", () => {
  afterEach(() => {
    gatewayRequest.mockReset();
  });

  it("uses typed gatewayRequest for usage.status", async () => {
    gatewayRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost"));

    expect(gatewayRequest).toHaveBeenCalledWith("usage.status", {});
  });
});
