import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (_req: Request, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/agents/[agentId]/files/[...path]", () => {
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
            name: "notes/README.md",
            payload: { name: "notes/README.md", content: "hello" },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main", path: ["notes", "README.md"] }) };

    const response = await GET(
      new Request("http://localhost/api/agents/main/files/notes/README.md") as never,
      ctx as never,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/agents/main/files/notes/README.md",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "notes/README.md", content: "hello" });
  });

  it("falls back to local gwRequest handler when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main", path: ["notes", "README.md"] }) };

    await GET(
      new Request("http://localhost/api/agents/main/files/notes/README.md") as never,
      ctx as never,
    );

    expect(gwRequest).toHaveBeenCalledWith("agents.files.get", {
      agentId: "main",
      name: "notes/README.md",
    });
  });
});
