import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();
const clearSessionProjections = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

vi.mock("@server/runtime", () => ({
  getRuntime: () => ({
    store: {
      clearSessionProjections,
    },
  }),
}));

describe("/api/chat/sessions/clear", () => {
  afterEach(() => {
    gwRequest.mockReset();
    clearSessionProjections.mockReset();
  });

  it("calls sessions.clear and clears local projection on success", async () => {
    gwRequest.mockResolvedValueOnce({ ok: true });
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/sessions/clear", {
      method: "POST",
      body: JSON.stringify({ sessionKey: "agent:main:main" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith("sessions.clear", {
      key: "agent:main:main",
    });
    expect(clearSessionProjections).toHaveBeenCalledWith("agent:main:main");
  });
});
