import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/monitor/runs", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runtimeId: "rt_local",
          runs: [
            {
              runId: "run-1",
              agentId: "main",
              sessionKey: "agent:main:session-1",
              firstEventAt: "2026-04-21T00:00:00Z",
              lastEventAt: "2026-04-21T00:01:00Z",
              eventCount: 3,
              status: "completed",
              toolCalls: 1,
              modelCalls: 1,
              totalTokens: 30,
            },
          ],
          requestId: "req-1",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/monitor/runs?limit=20"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/runs?limit=20",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runs: [
        {
          runId: "run-1",
          agentId: "main",
          sessionKey: "agent:main:session-1",
          firstEventAt: "2026-04-21T00:00:00Z",
          lastEventAt: "2026-04-21T00:01:00Z",
          eventCount: 3,
          status: "completed",
          toolCalls: 1,
          modelCalls: 1,
          totalTokens: 30,
        },
      ],
      nextCursor: null,
    });
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/monitor/runs?limit=20"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});
