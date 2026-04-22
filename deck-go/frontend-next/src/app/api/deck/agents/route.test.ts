import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/deck/agents", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/deck/agents?agentId=main"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/deck/agents?agentId=main",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET, POST } = await import("./route.js");

    await GET(new NextRequest("http://localhost/api/deck/agents?agentId=main"));
    await POST(
      new NextRequest("http://localhost/api/deck/agents", {
        method: "POST",
        body: JSON.stringify({ action: "skills.get", agentId: "main" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    await POST(
      new NextRequest("http://localhost/api/deck/agents", {
        method: "POST",
        body: JSON.stringify({
          action: "config.patch",
          path: "agents.defaults.thinkingDefault",
          value: "low",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "deck.agents.detail", { agentId: "main" });
    expect(gwRequest).toHaveBeenNthCalledWith(2, "deck.agents.skills.get", { agentId: "main" });
    expect(gwRequest).toHaveBeenNthCalledWith(3, "config.get", {});
    expect(gwRequest).toHaveBeenNthCalledWith(4, "config.patch", {
      raw: JSON.stringify({
        agents: {
          defaults: {
            thinkingDefault: "low",
          },
        },
      }),
    });
  });

  it("proxies POST helper actions to Stage 2 deck agent route when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/deck/agents", {
        method: "POST",
        body: JSON.stringify({ action: "skills.get", agentId: "main" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/deck/agents",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });
});
