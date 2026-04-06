import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/send", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("sends default chat messages via sessions.send", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/send", {
      method: "POST",
      body: JSON.stringify({
        sessionKey: "agent:main:main",
        message: "hello",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith(
      "sessions.send",
      expect.objectContaining({
        key: "agent:main:main",
        message: "hello",
      }),
    );
  });
});
