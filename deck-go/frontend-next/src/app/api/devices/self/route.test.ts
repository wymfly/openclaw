import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadOrCreateDeviceIdentity = vi.fn();

vi.mock("@server/device-identity", () => ({
  loadOrCreateDeviceIdentity,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/devices/self", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    loadOrCreateDeviceIdentity.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            deviceId: "dev-1",
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/devices/self"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/devices/self",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deviceId: "dev-1" });
  });

  it("falls back to local device identity when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    loadOrCreateDeviceIdentity.mockReturnValue({ deviceId: "dev-local" });
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/devices/self"));
    const payload = await response.json();
    expect(payload.deviceId).toBe("dev-local");
  });
});
