import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const setSetting = vi.fn();
const shutdownRuntime = vi.fn();
const initRuntime = vi.fn();

vi.mock("@server/deck-settings", () => ({
  setSetting,
}));

vi.mock("@server/runtime", () => ({
  shutdownRuntime,
  initRuntime,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/onboarding/save-settings", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    setSetting.mockReset();
    shutdownRuntime.mockReset();
    initRuntime.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/onboarding/save-settings", {
        method: "POST",
        body: JSON.stringify({ gatewayUrl: "ws://localhost:18789", gatewayToken: "token-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/onboarding/save-settings",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });

  it("falls back to local save when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    shutdownRuntime.mockResolvedValueOnce(undefined);
    initRuntime.mockReturnValueOnce({});
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/onboarding/save-settings", {
        method: "POST",
        body: JSON.stringify({ gatewayUrl: "ws://localhost:18789", gatewayToken: "token-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(setSetting).toHaveBeenCalled();
  });
});
