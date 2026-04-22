import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/sessions/create", () => {
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
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            key: "agent:main:new",
            sessionId: "session-new",
            entry: { key: "agent:main:new" },
            runStarted: true,
            runId: "run-new",
            status: "started",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/sessions/create", {
      method: "POST",
      body: JSON.stringify({
        agentId: "main",
        message: "boot",
        model: "gpt-5.4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/sessions:create",
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      key: "agent:main:new",
      sessionId: "session-new",
      entry: { key: "agent:main:new" },
      runStarted: true,
      runId: "run-new",
      status: "started",
    });
  });

  it("falls back to local gwRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/sessions/create", {
      method: "POST",
      body: JSON.stringify({
        agentId: "main",
        message: "boot",
        model: "gpt-5.4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith(
      "sessions.create",
      expect.objectContaining({
        agentId: "main",
        message: "boot",
        model: "gpt-5.4",
      }),
    );
  });
});
