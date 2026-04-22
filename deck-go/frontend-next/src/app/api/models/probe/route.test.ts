import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/models/probe", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, provider: "openai" }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");
    const response = await POST(
      new NextRequest("http://localhost/api/models/probe", {
        method: "POST",
        body: JSON.stringify({ provider: "openai", timeoutMs: 5000 }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/models/probe",
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/models/probe", {
        method: "POST",
        body: JSON.stringify({ provider: "openai", timeoutMs: 5000, maxTokens: 8 }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(gwRequest).toHaveBeenCalledWith(
      "deck.auth.probe",
      {
        provider: "openai",
        profileId: undefined,
        timeoutMs: 5000,
        maxTokens: 8,
      },
      { timeoutMs: 7000 },
    );
  });
});
