import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/cron/[jobId]/runs", () => {
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
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/cron/job-1/runs?limit=20&offset=5&sortDir=desc&statuses=ok,failed",
      ),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/cron/job-1/runs?limit=20&offset=5&sortDir=desc&statuses=ok,failed",
      expect.objectContaining({ method: "GET" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest for cron.runs", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(
      new NextRequest(
        "http://localhost/api/cron/job-1/runs?limit=20&offset=5&sortDir=desc&statuses=ok,failed",
      ),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );

    expect(gwRequest).toHaveBeenCalledWith("cron.runs", {
      scope: "job",
      jobId: "job-1",
      limit: 20,
      offset: 5,
      sortDir: "desc",
      statuses: ["ok", "failed"],
    });
  });
});
