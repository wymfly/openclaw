import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/chat/sessions/preview", () => {
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

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runtimeId: "rt_local",
          sessions: [
            { key: "session-1", lastMessagePreview: "preview text" },
            { key: "session-2", lastMessagePreview: "" },
          ],
          requestId: "req-1",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/chat/sessions/preview", {
        method: "POST",
        body: JSON.stringify({ keys: ["session-1"] }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/sessions",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ts: number;
      previews: Array<{
        key: string;
        status: string;
        items: Array<{ role: string; text: string }>;
      }>;
    };
    expect(typeof body.ts).toBe("number");
    expect(body.previews).toEqual([
      {
        key: "session-1",
        status: "ok",
        items: [{ role: "assistant", text: "preview text" }],
      },
    ]);
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { POST } = await import("./route.js");

    const response = await POST(
      new NextRequest("http://localhost/api/chat/sessions/preview", {
        method: "POST",
        body: JSON.stringify({ keys: ["session-1"] }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});
