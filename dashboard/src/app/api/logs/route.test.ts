import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/logs", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for logs.tail", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/logs?cursor=10&limit=25&maxBytes=5000");

    await GET(request);

    expect(gwRequest).toHaveBeenCalledWith("logs.tail", {
      cursor: 10,
      limit: 25,
      maxBytes: 5000,
    });
  });
});
