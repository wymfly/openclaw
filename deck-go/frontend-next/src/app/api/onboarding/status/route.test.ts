import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSetting = vi.fn();

vi.mock("@server/deck-settings", () => ({
  getSetting,
}));

describe("/api/onboarding/status", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
  const originalGatewayURL = process.env.DECK_GATEWAY_URL;
  const originalGatewayToken = process.env.DECK_GATEWAY_TOKEN;

  afterEach(() => {
    getSetting.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    process.env.DECK_GATEWAY_URL = originalGatewayURL;
    process.env.DECK_GATEWAY_TOKEN = originalGatewayToken;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ needsOnboarding: false }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/onboarding/status"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/onboarding/status",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
  });

  it("falls back to local settings when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    delete process.env.DECK_GATEWAY_URL;
    delete process.env.DECK_GATEWAY_TOKEN;
    getSetting.mockImplementation((key: string) => (key === "gateway_url" ? "" : ""));
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/onboarding/status"));
    const payload = await response.json();

    expect(payload.needsOnboarding).toBe(true);
  });
});
