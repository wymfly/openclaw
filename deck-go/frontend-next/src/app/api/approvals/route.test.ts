import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/approvals", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    }
  });

  it("proxies GET and POST to stage2 when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            payload: { path: "approvals.json", exists: true, hash: "h1" },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET, POST } = await import("./route.js");

    const getResponse = await GET(new NextRequest("http://localhost/api/approvals"));
    const postResponse = await POST(
      new NextRequest("http://localhost/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id: "ap-1", decision: "approve" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals/resolve",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await getResponse.json()).toEqual({ path: "approvals.json", exists: true, hash: "h1" });
    expect(postResponse.status).toBe(200);
  });

  it("uses typed gwRequest for approvals snapshot and resolve", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET, POST } = await import("./route.js");

    await GET(new NextRequest("http://localhost"));
    await POST(
      new NextRequest("http://localhost/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id: "ap-1", decision: "approve" }),
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "exec.approvals.get", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "exec.approval.resolve", {
      id: "ap-1",
      decision: "approve",
    });
  });
});
