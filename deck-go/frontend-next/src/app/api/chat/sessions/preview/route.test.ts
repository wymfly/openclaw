import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/chat/sessions/preview", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    gwRequest.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies POST to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
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
      expect.objectContaining({ method: "POST" }),
    );
    expect(gwRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ts: number;
      previews: Array<{ key: string; status: string; items: Array<{ role: string; text: string }> }>;
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

  it("falls back to local gwRequest when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/chat/sessions/preview", {
        method: "POST",
        body: JSON.stringify({ keys: ["session-1"] }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(gwRequest).toHaveBeenCalledWith("sessions.preview", { keys: ["session-1"] });
  });
});
