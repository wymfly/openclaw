import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/config/apply", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for config.apply", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/config/apply", {
      method: "POST",
      body: JSON.stringify({ raw: "{ }", baseHash: "abc" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith("config.apply", {
      raw: "{ }",
      baseHash: "abc",
    });
  });
});
