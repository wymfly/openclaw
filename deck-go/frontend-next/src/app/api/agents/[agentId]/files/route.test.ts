import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/agents/[agentId]/files", () => {
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
          payload: { files: [{ name: "AGENTS.md" }] },
          requestId: "req-1",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };

    const response = await GET(
      new NextRequest("http://localhost/api/agents/main/files"),
      ctx as never,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/main/files",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ files: [{ name: "AGENTS.md" }] });
  });

  it("returns 503 for GET when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };

    const response = await GET(
      new NextRequest("http://localhost/api/agents/main/files"),
      ctx as never,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });

  it("returns 503 for POST when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { POST } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };
    const request = new NextRequest("http://localhost/api/agents/main/files", {
      method: "POST",
      body: JSON.stringify({ name: "AGENTS.md", content: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request, ctx as never);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });

  it("proxies POST file writes to Stage 2 agents when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };
    const request = new NextRequest("http://localhost/api/agents/main/files", {
      method: "POST",
      body: JSON.stringify({ name: "AGENTS.md", content: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request, ctx as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/main/files",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });
});
