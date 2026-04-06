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
  afterEach(() => {
    vi.resetModules();
    getPendingApprovals.mockReset();
    getPendingApprovals.mockReturnValue([]);
    getRuntime.mockReset();
    fetchTranscriptHistory.mockReset();
    gwCall.mockReset();
    delete process.env.DECK_ACCESS_TOKEN;
  });

  it("falls back to the persisted projection when no in-memory approval exists", async () => {
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
        getApprovalProjectionWithMigration: vi.fn(() => ({
          id: "apr-projected",
          toolName: "command",
          command: "ls -la",
          description: "/tmp",
        })),
        getProjection: vi.fn(() => ({
          a2uiState: {
            visible: true,
          },
        })),
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
    expect(body.activeApproval).toMatchObject({
      id: "apr-projected",
      command: "ls -la",
    });
    expect(body.a2uiState).toMatchObject({ visible: true });
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
