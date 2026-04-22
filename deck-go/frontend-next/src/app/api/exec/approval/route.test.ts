import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gatewayRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/exec/approval", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gatewayRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");
    const response = await POST(
      new NextRequest("http://localhost/api/exec/approval", {
        method: "POST",
        body: JSON.stringify({ id: "ap-1", decision: "allow-once" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/approvals/resolve",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });

  it("falls back to local gatewayRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gatewayRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { POST } = await import("./route.js");
    await POST(
      new NextRequest("http://localhost/api/exec/approval", {
        method: "POST",
        body: JSON.stringify({ id: "ap-1", decision: "allow-once" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(gatewayRequest).toHaveBeenCalledWith("exec.approval.resolve", {
      id: "ap-1",
      decision: "allow-once",
    });
  });
});
