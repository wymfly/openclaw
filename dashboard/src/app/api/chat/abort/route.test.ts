import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/abort", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("aborts runs via sessions.abort", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/abort", {
      method: "POST",
      body: JSON.stringify({
        sessionKey: "agent:main:main",
        runId: "run-1",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith("sessions.abort", {
      key: "agent:main:main",
      runId: "run-1",
    });
  });
});
