import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwCall = vi.fn();
const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/channels/[channelId]/test", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwCall.mockReset();
    gwRequest.mockReset();
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
    const res = await POST(
      new NextRequest("http://localhost/api/channels/telegram/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ channelId: "telegram" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/channels/telegram/test",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res.status).toBe(200);
  });

  it("requires a successful account probe instead of channel summary presence", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwCall.mockResolvedValueOnce({
      channelAccounts: {
        telegram: [
          {
            accountId: "main",
            probe: { ok: true, latencyMs: 123 },
          },
        ],
      },
    });

    const { POST } = await import("./route.js");

    const res = await POST(
      new NextRequest("http://localhost/api/channels/telegram/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ channelId: "telegram" }) },
    );

    expect(gwCall).toHaveBeenCalledWith("channels.status", { probe: true });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.channelId).toBe("telegram");
    expect(data.check).toBe("probe");
    expect(data.messageId).toBeUndefined();
  });

  it("surfaces upstream probe failure instead of returning a false positive", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwCall.mockRejectedValueOnce(new Error("Gateway unavailable"));
    gwRequest.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Gateway unavailable", code: "GATEWAY_UNAVAILABLE" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { POST } = await import("./route.js");

    const res = await POST(
      new NextRequest("http://localhost/api/channels/telegram/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ channelId: "telegram" }) },
    );

    expect(res.status).toBe(503);
    expect(gwRequest).toHaveBeenCalledWith("channels.status", { probe: true });
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      channelId: "telegram",
      check: "probe",
      error: "Gateway unavailable",
      code: "GATEWAY_UNAVAILABLE",
    });
  });
});
