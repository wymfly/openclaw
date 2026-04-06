import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/deck/tools-effective", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for tools.effective", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/deck/tools-effective", {
      method: "POST",
      body: JSON.stringify({ agentId: "main", sessionKey: "agent:main:main" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith("tools.effective", {
      agentId: "main",
      sessionKey: "agent:main:main",
    });
  });
});
