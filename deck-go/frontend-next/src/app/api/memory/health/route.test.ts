import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
const getRuntime = vi.fn();

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/memory/health", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    request.mockReset();
    getRuntime.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            runtimeId: "rt_local",
            payload: { entries: [], lanceDbEnabled: false },
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/memory/health"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/memory/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [], lanceDbEnabled: false });
  });

  it("falls back to runtime.adapter.request for doctor.memory.status", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    request.mockResolvedValue({ entries: [], lanceDbEnabled: false });
    getRuntime.mockReturnValue({
      adapter: { request },
    });
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost"));
    const body = await response.json();

    expect(request).toHaveBeenCalledWith("doctor.memory.status", {});
    expect(body).toEqual({ entries: [], lanceDbEnabled: false });
  });
});
