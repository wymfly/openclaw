import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/deck/agents", () => {
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
    expect(response.status).toBe(200);
  });

  it("returns 503 for valid requests when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new NextRequest("http://localhost/api/deck/agents?agentId=main"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/deck/agents", {
        method: "POST",
        body: JSON.stringify({ action: "skills.get", agentId: "main" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(getResponse.status).toBe(503);
    expect(await getResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
    expect(postResponse.status).toBe(503);
    expect(await postResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
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

  it("keeps thin validation for missing agentId, invalid action, and invalid config path", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET, POST } = await import("./route.js");

    const missingAgent = await GET(new NextRequest("http://localhost/api/deck/agents"));
    const invalidAction = await POST(
      new NextRequest("http://localhost/api/deck/agents", {
        method: "POST",
        body: JSON.stringify({ action: "bogus" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const invalidPath = await POST(
      new NextRequest("http://localhost/api/deck/agents", {
        method: "POST",
        body: JSON.stringify({ action: "config.patch", path: "agents..bad", value: "low" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(missingAgent.status).toBe(400);
    expect(await missingAgent.json()).toEqual({ error: "agentId is required" });
    expect(invalidAction.status).toBe(400);
    expect(await invalidAction.json()).toEqual({ error: "Invalid action" });
    expect(invalidPath.status).toBe(400);
    expect(await invalidPath.json()).toEqual({ error: "Invalid config path" });
  });
});
