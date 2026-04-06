import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/sessions/create", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("creates sessions via sessions.create", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/sessions/create", {
      method: "POST",
      body: JSON.stringify({
        agentId: "main",
        message: "boot",
        model: "gpt-5.4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith(
      "sessions.create",
      expect.objectContaining({
        agentId: "main",
        message: "boot",
        model: "gpt-5.4",
      }),
    );
  });
});
