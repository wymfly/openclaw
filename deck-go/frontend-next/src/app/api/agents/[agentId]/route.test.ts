import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    }
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
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

    const response = await GET(new NextRequest("http://localhost/api/agents/main"), {
      params: Promise.resolve({ agentId: "main" }),
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/main",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "main", name: "Main" });
  });

  it("returns 503 for GET and PATCH when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

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
    const patchResponse = await PATCH(patchRequest, ctx as never);

    expect(getResponse.status).toBe(503);
    expect(await getResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
    expect(patchResponse.status).toBe(503);
    expect(await patchResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
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
