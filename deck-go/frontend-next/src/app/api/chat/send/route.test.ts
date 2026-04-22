import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/send", () => {
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
            accepted: true,
            requestId: "req-1",
            commandId: "cmd-1",
            submittedAt: "2026-04-21T00:00:00Z",
          }),
          { status: 202 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/send", {
      method: "POST",
      body: JSON.stringify({
        sessionKey: "agent:main:main",
        message: "hello",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/sessions/agent%3Amain%3Amain/messages:send",
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "cmd-1",
      status: "started",
    });
  });

  it("falls back to local gwRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/chat/send", {
      method: "POST",
      body: JSON.stringify({
        sessionKey: "agent:main:main",
        message: "hello",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith(
      "sessions.send",
      expect.objectContaining({
        key: "agent:main:main",
        message: "hello",
      }),
    );
  });
});
