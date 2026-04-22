import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPendingApprovals = vi.fn();

vi.mock("@server/approval-bridge", () => ({
  getPendingApprovals,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/approvals/pending", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getPendingApprovals.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ pending: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/approvals/pending"));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals/pending",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
  });

  it("falls back to local pending approvals when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    getPendingApprovals.mockReturnValue([{ id: "ap-1" }]);
    const { GET } = await import("./route.js");
    const response = await GET(new NextRequest("http://localhost/api/approvals/pending"));
    const payload = await response.json();
    expect(payload.pending).toHaveLength(1);
  });
});
