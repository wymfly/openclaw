import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwCall = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/devices/token/rotate", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwCall.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/devices/token/rotate", {
        method: "POST",
        body: JSON.stringify({ deviceId: "dev-1", role: "operator" }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/devices/token/rotate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwCall).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwCall when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwCall.mockResolvedValueOnce({ ok: true });
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/devices/token/rotate", {
        method: "POST",
        body: JSON.stringify({ deviceId: "dev-1", role: "operator" }),
      }),
    );

    expect(gwCall).toHaveBeenCalledWith("device.token.rotate", {
      deviceId: "dev-1",
      role: "operator",
    });
  });
});
