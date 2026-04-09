import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/usage/cost", () => {
  afterEach(() => {
    gatewayRequest.mockReset();
  });

  it("uses typed gatewayRequest for usage.cost", async () => {
    gatewayRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/usage/cost?days=7"));

    expect(gatewayRequest).toHaveBeenCalledWith("usage.cost", { days: 7 });
  });
});
