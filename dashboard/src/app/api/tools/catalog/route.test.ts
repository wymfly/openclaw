import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/tools/catalog", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for tools.catalog", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/tools/catalog", {
      method: "POST",
      body: JSON.stringify({ agentId: "main", includePlugins: false }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith("tools.catalog", {
      agentId: "main",
      includePlugins: false,
    });
  });
});
