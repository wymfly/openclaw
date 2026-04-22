import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPendingApprovals = vi.fn(() => []);
const getRuntime = vi.fn<() => unknown>(() => null);
const fetchTranscriptHistory = vi.fn();
const gwCall = vi.fn();

vi.mock("@server/approval-bridge", () => ({
  getPendingApprovals,
}));

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

vi.mock("@/lib/transcript-history", () => ({
  fetchTranscriptHistory,
}));

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
}));

describe("/api/chat/snapshot", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    getPendingApprovals.mockReset();
    getPendingApprovals.mockReturnValue([]);
    getRuntime.mockReset();
    fetchTranscriptHistory.mockReset();
    gwCall.mockReset();
    delete process.env.DECK_ACCESS_TOKEN;
  });

  it("proxies to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            sessionId: "session-1",
            timeline: [{ id: "msg-1", role: "assistant", content: [{ type: "text", text: "hi" }] }],
            activeRun: { status: "running", sessionId: "session-1", agentId: "main" },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/chat/snapshot?sessionKey=session-1"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/sessions/session-1/timeline",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      messages: [{ id: "msg-1", role: "assistant", content: [{ type: "text", text: "hi" }] }],
      meta: {
        key: "session-1",
        sessionKey: "session-1",
        agentId: null,
      },
      activeApproval: null,
      a2uiState: null,
      activeRun: { status: "running", sessionId: "session-1", agentId: "main" },
    });
  });

  it("returns null projection-backed approval state when no in-memory approval exists", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwCall.mockResolvedValueOnce({
      sessions: [{ key: "session-1", agentId: "main", updatedAt: 1 }],
    });
    fetchTranscriptHistory.mockResolvedValue([
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
    ]);
    getRuntime.mockReturnValue({
      db: undefined,
      rateLimiter: undefined,
      adapter: {
        request: vi.fn(),
      },
      store: {
        getApprovalProjectionWithMigration: vi.fn(),
        getProjection: vi.fn(),
      },
    });

    const { GET } = await import("./route.js");
    const response = await GET(
      new NextRequest("http://localhost/api/chat/snapshot?sessionKey=session-1"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      activeApproval: { id: string; command?: string } | null;
      a2uiState: { visible?: boolean } | null;
      messages: unknown[];
    };
    expect(body.messages).toHaveLength(1);
    expect(body.activeApproval).toBeNull();
    expect(body.a2uiState).toBeNull();
    expect(fetchTranscriptHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sessionKey: "session-1" }),
    );
    expect(gwCall).toHaveBeenNthCalledWith(
      1,
      "sessions.list",
      expect.objectContaining({ limit: 50 }),
    );
  });
});
