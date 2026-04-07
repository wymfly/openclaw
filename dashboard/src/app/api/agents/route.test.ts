import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();
const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/agents", () => {
  afterEach(() => {
    gwRequest.mockReset();
    gatewayRequest.mockReset();
  });

  it("uses typed gwRequest for agents.list on GET", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost"));

    expect(gwRequest).toHaveBeenCalledWith("agents.list", {});
  });
});
