import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/usage/sessions/logs", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for sessions.usage.logs", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const request = new NextRequest(
      "http://localhost/api/usage/sessions/logs?key=agent%3Amain%3Amain&limit=50",
    );

    await GET(request);

    expect(gwRequest).toHaveBeenCalledWith("sessions.usage.logs", {
      key: "agent:main:main",
      limit: 50,
    });
  });
});
