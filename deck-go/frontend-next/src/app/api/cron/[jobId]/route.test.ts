import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/cron/[jobId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    }
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
    expect(response.status).toBe(200);
  });

  it("returns 503 for PATCH and DELETE when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { PATCH, DELETE } = await import("./route.js");
    const ctx = { params: Promise.resolve({ jobId: "job-1" }) };

    const patchResponse = await PATCH(
      new NextRequest("http://localhost/api/cron/job-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      ctx,
    );
    const deleteResponse = await DELETE(new NextRequest("http://localhost/api/cron/job-1"), ctx);

    expect(patchResponse.status).toBe(503);
    expect(await patchResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
    expect(deleteResponse.status).toBe(503);
    expect(await deleteResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
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
