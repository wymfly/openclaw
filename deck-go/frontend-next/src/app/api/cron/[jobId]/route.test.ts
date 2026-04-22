import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/cron/[jobId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies PATCH to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { PATCH } = await import("./route.js");
    const ctx = { params: Promise.resolve({ jobId: "job-1" }) };

    const response = await PATCH(
      new NextRequest("http://localhost/api/cron/job-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      ctx,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/cron/job-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest for cron.update and cron.remove", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { PATCH, DELETE } = await import("./route.js");
    const ctx = { params: Promise.resolve({ jobId: "job-1" }) };

    await PATCH(
      new NextRequest("http://localhost/api/cron/job-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      ctx,
    );
    await DELETE(new NextRequest("http://localhost/api/cron/job-1"), ctx);

    expect(gwRequest).toHaveBeenNthCalledWith(1, "cron.update", {
      id: "job-1",
      patch: { enabled: false },
    });
    expect(gwRequest).toHaveBeenNthCalledWith(2, "cron.remove", { id: "job-1" });
  });

  it("proxies DELETE to Stage 2 cron when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { DELETE } = await import("./route.js");
    const ctx = { params: Promise.resolve({ jobId: "job-1" }) };

    const response = await DELETE(
      new NextRequest("http://localhost/api/cron/job-1", { method: "DELETE" }),
      ctx,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/cron/job-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
  });
});
