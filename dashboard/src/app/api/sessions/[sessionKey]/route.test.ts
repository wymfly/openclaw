import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/sessions/[sessionKey]", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for sessions.delete only", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const ctx = { params: Promise.resolve({ sessionKey: "agent:main:main" }) };
    const mod = await import("./route.js");

    await mod.DELETE(new NextRequest("http://localhost/api/sessions/agent:main:main"), ctx);

    expect("GET" in mod).toBe(false);
    expect(gwRequest).toHaveBeenCalledOnce();
    expect(gwRequest).toHaveBeenCalledWith("sessions.delete", {
      key: "agent:main:main",
    });
  });
});
