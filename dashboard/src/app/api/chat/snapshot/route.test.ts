import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getPendingApprovals = vi.fn(() => []);
const getRuntime = vi.fn<() => unknown>(() => null);

vi.mock("@server/approval-bridge", () => ({
  getPendingApprovals,
}));

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

describe("/api/chat/snapshot", () => {
  afterEach(() => {
    vi.resetModules();
    getPendingApprovals.mockReset();
    getPendingApprovals.mockReturnValue([]);
    getRuntime.mockReset();
    delete process.env.DECK_ACCESS_TOKEN;
  });

  it("falls back to the persisted projection when no in-memory approval exists", async () => {
    getRuntime.mockReturnValue({
      db: undefined,
      rateLimiter: undefined,
      adapter: {
        request: vi
          .fn()
          .mockResolvedValueOnce({
            messages: [{ role: "assistant", content: [{ type: "text", text: "hi" }] }],
          })
          .mockResolvedValueOnce({
            sessions: [{ key: "session-1", agentId: "main", updatedAt: 1 }],
          }),
      },
      store: {
        getChatSessionProjection: vi.fn(() => ({
          activeApproval: {
            id: "apr-projected",
            toolName: "command",
            command: "ls -la",
            description: "/tmp",
          },
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
  });
});
