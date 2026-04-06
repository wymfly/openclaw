import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/sessions", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for sessions.list", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const request = new NextRequest(
      "http://localhost/api/sessions?search=test&limit=5&activeMinutes=30",
    );

    await GET(request);

    expect(gwRequest).toHaveBeenCalledWith("sessions.list", {
      search: "test",
      limit: 5,
      activeMinutes: 30,
    });
  });
});
