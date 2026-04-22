import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init),
    },
  };
});

describe("/api/agents/[agentId]", () => {
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
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            agentId: "main",
            payload: { id: "main", name: "Main" },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/agents/main"),
      { params: Promise.resolve({ agentId: "main" }) } as never,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/main",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "main", name: "Main" });
  });

  it("falls back to local gwRequest handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agents: [{ id: "main", name: "Main" }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { GET, PATCH } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };

    const getResponse = await GET(
      new NextRequest("http://localhost/api/agents/main"),
      ctx as never,
    );
    const patchRequest = new NextRequest("http://localhost/api/agents/main", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Main" }),
      headers: { "Content-Type": "application/json" },
    });
    await PATCH(patchRequest, ctx as never);

    expect(gwRequest).toHaveBeenNthCalledWith(1, "agents.list", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "agents.update", {
      agentId: "main",
      name: "Updated Main",
    });
    expect(getResponse.status).toBe(200);
  });

  it("proxies PATCH to Stage 2 agents when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { PATCH } = await import("./route.js");

    const response = await PATCH(
      new NextRequest("http://localhost/api/agents/main", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Main" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ agentId: "main" }) } as never,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/main",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(response.status).toBe(200);
  });
});
