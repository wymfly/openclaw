import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getRunAggregator = vi.fn();

vi.mock("@server/run-aggregator", () => ({
  getRunAggregator,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ...args: unknown[]) => Promise<Response> | Response) => handler,
}));

describe("/api/monitor/runs/[runId]", () => {
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
            runId: "run-1",
            run: {
              runId: "run-1",
              firstEventAt: "2026-04-21T00:00:00Z",
              lastEventAt: "2026-04-21T00:01:00Z",
              eventCount: 3,
              toolCalls: 1,
              modelCalls: 1,
              fileOps: 1,
              subagentSpawns: 0,
              totalTokens: 30,
              compacted: false,
            },
            events: [{ id: 1, run_id: "run-1", seq: 1, stream: "chat", data: "{}", agent_id: "main", session_key: "agent:main:session-1", created_at: "2026-04-21T00:00:00Z" }],
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/monitor/runs/run-1"),
      { params: Promise.resolve({ runId: "run-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/runs/run-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      summary: {
        toolCalls: 1,
        modelCalls: 1,
        fileOps: 1,
        subagentSpawns: 0,
        compacted: false,
        totalInputTokens: 0,
        totalOutputTokens: 30,
        totalCacheTokens: 0,
        durationMs: 60000,
        eventCount: 3,
      },
      events: [{ id: 1, run_id: "run-1", seq: 1, stream: "chat", data: "{}", agent_id: "main", session_key: "agent:main:session-1", created_at: "2026-04-21T00:00:00Z" }],
    });
  });

  it("falls back to local run aggregator when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    getRunAggregator.mockReturnValue({
      getRunSummary: () => ({ eventCount: 1 }),
    });
    const { GET } = await import("./route.js");
    const response = await GET(
      new NextRequest("http://localhost/api/monitor/runs/run-1"),
      { params: Promise.resolve({ runId: "run-1" }) },
    );
    expect(response.status).toBe(200);
  });
});
