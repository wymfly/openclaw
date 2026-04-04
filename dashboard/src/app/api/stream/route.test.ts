import { afterEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.fn();
const unsubscribe = vi.fn();
const getEventsSince = vi.fn(() => []);
const storeGetEventsSince = vi.fn<
  () => {
    events: Array<{
      id: number;
      eventType: string;
      payload: unknown;
      createdAt: string;
    }>;
    gapDetected: boolean;
  }
>(() => ({ events: [], gapDetected: false }));
const getRuntime = vi.fn<() => unknown>(() => null);

vi.mock("@server/event-bus", () => ({
  getEventBus: () => ({
    subscribe,
    unsubscribe,
    getEventsSince,
  }),
}));

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

describe("/api/stream auth", () => {
  const originalToken = process.env.DECK_ACCESS_TOKEN;

  afterEach(() => {
    vi.resetModules();
    subscribe.mockReset();
    unsubscribe.mockReset();
    getEventsSince.mockReset();
    getEventsSince.mockReturnValue([]);
    storeGetEventsSince.mockReset();
    storeGetEventsSince.mockReturnValue({ events: [], gapDetected: false });
    getRuntime.mockReset();
    getRuntime.mockReturnValue(null);
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

  it("replays missed events from the persistent outbox when runtime storage is available", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    storeGetEventsSince.mockReturnValue({
      events: [
        {
          id: 41,
          eventType: "chat",
          payload: { state: "final", sessionKey: "session-1" },
          createdAt: new Date().toISOString(),
        },
      ],
      gapDetected: false,
    });
    getRuntime.mockReturnValue({
      store: {
        getEventsSince: storeGetEventsSince,
      },
    });

    const { GET } = await import("./route.js");
    const response = GET(
      new Request("http://localhost/api/stream", {
        headers: { "Last-Event-ID": "40" },
      }),
    );

    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    const first = await reader?.read();
    await reader?.cancel();

    const chunk = new TextDecoder().decode(first?.value);
    expect(storeGetEventsSince).toHaveBeenCalledWith(40);
    expect(getEventsSince).not.toHaveBeenCalled();
    expect(chunk).toContain("id: 41");
    expect(chunk).toContain("event: chat");
  });

  it("emits projection.gap SSE event when gap is detected", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    storeGetEventsSince.mockReturnValue({
      events: [
        {
          id: 100,
          eventType: "chat",
          payload: { token: "hi" },
          createdAt: new Date().toISOString(),
        },
      ],
      gapDetected: true,
    });
    getRuntime.mockReturnValue({
      store: { getEventsSince: storeGetEventsSince },
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
    storeGetEventsSince.mockReturnValue({
      events: [
        {
          id: 6,
          eventType: "chat",
          payload: { token: "ok" },
          createdAt: new Date().toISOString(),
        },
      ],
      gapDetected: false,
    });
    getRuntime.mockReturnValue({
      store: { getEventsSince: storeGetEventsSince },
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

  it("falls back to EventBus when runtime store is unavailable", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    getEventsSince.mockReturnValue([
      { id: 10, type: "chat", data: { token: "bus" }, timestamp: Date.now() },
    ]);
    getRuntime.mockReturnValue(null);

    const { GET } = await import("./route.js");
    const response = GET(
      new Request("http://localhost/api/stream", {
        headers: { "Last-Event-ID": "9" },
      }),
    );

    const reader = response.body?.getReader();
    const first = await reader?.read();
    await reader?.cancel();

    expect(getEventsSince).toHaveBeenCalledWith(9);
    expect(storeGetEventsSince).not.toHaveBeenCalled();

    const chunk = new TextDecoder().decode(first?.value);
    expect(chunk).toContain("id: 10");
    expect(chunk).toContain("event: chat");
  });
});
