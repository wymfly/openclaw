import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/skills/[skillKey]", () => {
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

    const response = await PATCH(
      new NextRequest("http://localhost/api/skills/demo", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ skillKey: "demo" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/skills/demo",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local gwRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { PATCH } = await import("./route.js");

    await PATCH(
      new NextRequest("http://localhost/api/skills/demo", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ skillKey: "demo" }) },
    );

    expect(gwRequest).toHaveBeenCalledWith("skills.update", {
      skillKey: "demo",
      enabled: false,
    });
  });
});
