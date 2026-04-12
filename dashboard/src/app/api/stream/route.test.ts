import { afterEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.fn();
const unsubscribe = vi.fn();
const getEventsSince = vi.fn<
  () => { events: Array<{ id: number; type: string; data: unknown; timestamp: number }>; gapDetected: boolean }
>(() => ({ events: [], gapDetected: false }));

vi.mock("@server/event-bus", () => ({
  getEventBus: () => ({
    subscribe,
    unsubscribe,
    getEventsSince,
  }),
}));

describe("/api/stream", () => {
  const originalToken = process.env.DECK_ACCESS_TOKEN;

  afterEach(() => {
    vi.resetModules();
    subscribe.mockReset();
    unsubscribe.mockReset();
    getEventsSince.mockReset();
    getEventsSince.mockReturnValue({ events: [], gapDetected: false });
    if (originalToken === undefined) {
      delete process.env.DECK_ACCESS_TOKEN;
    } else {
      process.env.DECK_ACCESS_TOKEN = originalToken;
    }
  });

  it("returns 401 when Deck access token is configured but request headers do not include it", async () => {
    process.env.DECK_ACCESS_TOKEN = "stream-secret";
    const { GET } = await import("./route.js");

    const response = GET(new Request("http://localhost/api/stream"));

    expect(response.status).toBe(401);
  });

  it("allows the stream when a valid x-deck-token header is present", async () => {
    process.env.DECK_ACCESS_TOKEN = "stream-secret";
    const { GET } = await import("./route.js");

    const response = GET(
      new Request("http://localhost/api/stream", {
        headers: { "x-deck-token": "stream-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("allows the stream in local dev mode when no token is configured", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    const { GET } = await import("./route.js");

    const response = GET(new Request("http://localhost/api/stream"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("replays missed events from EventBus memory buffer", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    getEventsSince.mockReturnValue({
      events: [
        { id: 41, type: "chat", data: { state: "final", sessionKey: "session-1" }, timestamp: Date.now() },
      ],
      gapDetected: false,
    });

    const { GET } = await import("./route.js");
    const response = GET(
      new Request("http://localhost/api/stream", {
        headers: { "Last-Event-ID": "40" },
      }),
    );

    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    const first = await reader?.read();
    await reader?.cancel();

    const chunk = new TextDecoder().decode(first?.value);
    expect(getEventsSince).toHaveBeenCalledWith(40);
    expect(chunk).toContain("id: 41");
    expect(chunk).toContain("event: chat");
  });

  it("emits projection.gap SSE event when gap is detected", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    getEventsSince.mockReturnValue({
      events: [
        { id: 100, type: "chat", data: { token: "hi" }, timestamp: Date.now() },
      ],
      gapDetected: true,
    });

    const { GET } = await import("./route.js");
    const response = GET(
      new Request("http://localhost/api/stream", {
        headers: { "Last-Event-ID": "5" },
      }),
    );

    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    const first = await reader?.read();
    await reader?.cancel();

    const chunk = new TextDecoder().decode(first?.value);
    expect(chunk).toContain("event: projection.gap");
    expect(chunk).toContain('"reason":"events_pruned"');
  });

  it("does NOT emit projection.gap when no gap detected", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    getEventsSince.mockReturnValue({
      events: [
        { id: 6, type: "chat", data: { token: "ok" }, timestamp: Date.now() },
      ],
      gapDetected: false,
    });

    const { GET } = await import("./route.js");
    const response = GET(
      new Request("http://localhost/api/stream", {
        headers: { "Last-Event-ID": "5" },
      }),
    );

    const reader = response.body?.getReader();
    const first = await reader?.read();
    await reader?.cancel();

    const chunk = new TextDecoder().decode(first?.value);
    expect(chunk).not.toContain("projection.gap");
  });

  it("does not replay when no Last-Event-ID header", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    const { GET } = await import("./route.js");

    const response = GET(new Request("http://localhost/api/stream"));
    expect(response.status).toBe(200);
    expect(getEventsSince).not.toHaveBeenCalled();
  });
});
