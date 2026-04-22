import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwCall = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/memory/browse", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwCall.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ files: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/memory/browse?agentId=main&path=note.md&read=1"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/memory/browse?agentId=main&path=note.md&read=1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
  });

  it("falls back to local handler validation when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/memory/browse?agentId=bad/../id"));
    expect(response.status).toBe(400);
  });
});
