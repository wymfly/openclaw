import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/agents/[agentId]/files", () => {
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
            payload: { files: [{ name: "AGENTS.md" }] },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };

    const response = await GET(new NextRequest("http://localhost/api/agents/main/files"), ctx as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/main/files",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ files: [{ name: "AGENTS.md" }] });
  });

  it("falls back to local gwRequest handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };

    await GET(new NextRequest("http://localhost/api/agents/main/files"), ctx as never);

    expect(gwRequest).toHaveBeenCalledWith("agents.files.list", { agentId: "main" });
  });

  it("falls back to local POST handler when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };
    const request = new NextRequest("http://localhost/api/agents/main/files", {
      method: "POST",
      body: JSON.stringify({ name: "AGENTS.md", content: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request, ctx as never);

    expect(gwRequest).toHaveBeenCalledWith("agents.files.set", {
      agentId: "main",
      name: "AGENTS.md",
      content: "hello",
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
