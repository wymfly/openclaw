import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getRuntime = vi.fn();
const extractDocsFromMessages = vi.fn();
const fetchTranscriptHistory = vi.fn();
const getDocStore = vi.fn();

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

vi.mock("@/lib/doc-extractor", () => ({
  extractDocsFromMessages,
}));

vi.mock("@/lib/transcript-history", () => ({
  fetchTranscriptHistory,
}));

vi.mock("../store", () => ({
  getDocStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/docs/extract", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getRuntime.mockReset();
    extractDocsFromMessages.mockReset();
    fetchTranscriptHistory.mockReset();
    getDocStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ extracted: 0, docs: [] }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/docs/extract", {
        method: "POST",
        body: JSON.stringify({ sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/docs/extract",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchTranscriptHistory).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local extraction when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const append = vi.fn();
    getRuntime.mockReturnValue({});
    fetchTranscriptHistory.mockResolvedValueOnce([{ role: "assistant", content: "long enough content".repeat(20) }]);
    extractDocsFromMessages.mockReturnValueOnce([
      { title: "Spec", category: "spec", content: "body", keywords: ["spec"], language: "en" },
    ]);
    getDocStore.mockReturnValue({ append });
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/docs/extract", {
        method: "POST",
        body: JSON.stringify({ sessionKey: "session-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchTranscriptHistory).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(1);
  });
});
