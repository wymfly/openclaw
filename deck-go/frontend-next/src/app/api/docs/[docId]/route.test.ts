import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDocStore = vi.fn();

vi.mock("../store", () => ({
  getDocStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/docs/[docId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getDocStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies GET to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: "doc-1" }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(
      new NextRequest("http://localhost/api/docs/doc-1"),
      { params: Promise.resolve({ docId: "doc-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/docs/doc-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(getDocStore).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local doc store for GET and DELETE when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const removeWhere = vi.fn().mockReturnValue(1);
    getDocStore.mockReturnValue({
      find: vi.fn().mockReturnValue({ id: "doc-1", title: "Spec" }),
      removeWhere,
    });
    const { GET, DELETE } = await import("./route.js");

    const getResponse = await GET(
      new NextRequest("http://localhost/api/docs/doc-1"),
      { params: Promise.resolve({ docId: "doc-1" }) },
    );
    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/docs/doc-1", { method: "DELETE" }),
      { params: Promise.resolve({ docId: "doc-1" }) },
    );

    expect(getResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(removeWhere).toHaveBeenCalledTimes(1);
  });

  it("proxies DELETE to Stage 2 docs when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { DELETE } = await import("./route.js");

    const response = await DELETE(
      new NextRequest("http://localhost/api/docs/doc-1", { method: "DELETE" }),
      { params: Promise.resolve({ docId: "doc-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/docs/doc-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
  });
});
