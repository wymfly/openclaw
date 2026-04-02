import { afterEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.fn();
const unsubscribe = vi.fn();
const getEventsSince = vi.fn(() => []);
const getRuntime = vi.fn(() => null);

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
});
