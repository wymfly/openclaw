import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getRunAggregator = vi.fn();

vi.mock("@server/run-aggregator", () => ({
  getRunAggregator,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/monitor/stats", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getRunAggregator.mockReset();
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
            stats: { totalRuns: 1, todayRuns: 1, avgDurationMs: 42, topAgents: [{ agentId: "main", runCount: 1 }] },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/monitor/stats"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/stats",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalRuns: 1,
      todayRuns: 1,
      avgDurationMs: 42,
      topAgents: [{ agentId: "main", runCount: 1 }],
    });
  });

  it("falls back to local run aggregator when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    getRunAggregator.mockReturnValue({
      getStats: () => ({ totalRuns: 0, todayRuns: 0, avgDurationMs: 0, topAgents: [] }),
    });
    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/monitor/stats"));
    expect(response.status).toBe(200);
  });
});
