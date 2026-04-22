import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

vi.mock("@server/runtime", () => ({
  getRuntime: () => null,
}));

describe("/api/agents", () => {
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
            payload: { agents: [{ id: "main", name: "Main" }] },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/agents"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ agents: [{ id: "main", name: "Main" }] });
  });

  it("falls back to local handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new NextRequest("http://localhost"));

    expect(gwRequest).toHaveBeenCalledWith("agents.list", {});
  });

  it("proxies POST to Stage 2 agents when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, id: "Ops" }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        body: JSON.stringify({ name: "Ops" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });

  it("proxies DELETE to Stage 2 agents when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { DELETE } = await import("./route.js");

    const response = await DELETE(
      new NextRequest("http://localhost/api/agents?agentId=ops", { method: "DELETE" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/ops",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
  });

  it("falls back to local create and delete handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { POST, DELETE } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        body: JSON.stringify({ name: "Ops", workspace: "/tmp/workspace-ops" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    await DELETE(new NextRequest("http://localhost/api/agents?agentId=ops", { method: "DELETE" }));

    expect(gwRequest).toHaveBeenNthCalledWith(1, "agents.create", {
      name: "Ops",
      workspace: "/tmp/workspace-ops",
    });
    expect(gwRequest).toHaveBeenNthCalledWith(2, "agents.delete", { agentId: "ops" });
  });
});
