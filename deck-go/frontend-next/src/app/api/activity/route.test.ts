import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getEventBus = vi.fn();

vi.mock("@server/event-bus", () => ({
  getEventBus,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/activity", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getEventBus.mockReset();
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
            events: [{ id: "act-1", timestamp: 1, type: "chat", description: "done" }],
            requestId: "req-1",
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/activity?limit=100"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/activity?limit=100",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [{ id: "act-1", timestamp: 1, type: "chat", description: "done" }],
    });
  });

  it("falls back to local event bus when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    getEventBus.mockReturnValue({
      getEventsSince: () => ({
        events: [
          {
            type: "activity.event",
            id: 1,
            timestamp: Date.now(),
            data: { id: "act-1", timestamp: Date.now(), type: "alert", description: "Alert" },
          },
        ],
      }),
    });
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost/api/activity?limit=10"));
    expect(response.status).toBe(200);
  });
});
