import { afterEach, describe, expect, it, vi } from "vitest";

describe("deckStream", () => {
  const originalFetch = globalThis.fetch;
  const originalPrompt = globalThis.prompt;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    globalThis.prompt = originalPrompt;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("sends x-deck-token and Last-Event-ID headers when opening the stream", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('id: 7\nevent: ping\ndata: {"ok":true}\n\n'));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        },
      ),
    );
    globalThis.fetch = fetchMock;

    const { deckStream } = await import("./deck-client.js");

    await deckStream("/api/stream", {
      token: "stream-secret",
      lastEventId: 42,
      onEvent() {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-deck-token")).toBe("stream-secret");
    expect(headers.get("Last-Event-ID")).toBe("42");
  });

  it("retries once with prompted token after a 401 response", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('id: 8\nevent: ready\ndata: {"ok":true}\n\n'));
              controller.close();
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
      );
    globalThis.fetch = fetchMock;
    globalThis.prompt = vi.fn(() => "prompted-secret");

    const { deckStream, setDeckAccessToken } = await import("./deck-client.js");
    setDeckAccessToken(null);

    await deckStream("/api/stream", {
      onEvent() {},
    });

    expect(globalThis.prompt).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retryInit] = fetchMock.mock.calls[1];
    const retryHeaders = new Headers(retryInit?.headers);
    expect(retryHeaders.get("x-deck-token")).toBe("prompted-secret");
  });

  it("retries a reconnecting stream after an initial network failure", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('id: 9\nevent: ready\ndata: {"ok":true}\n\n'));
              controller.close();
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
      );
    globalThis.fetch = fetchMock;

    const { deckStream, setDeckAccessToken } = await import("./deck-client.js");
    setDeckAccessToken(null);
    const events: string[] = [];
    const controller = new AbortController();

    const response = await deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      retryDelayMs: 0,
      onEvent(event) {
        if (event.event) {
          events.push(event.event);
          controller.abort();
        }
      },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events).toEqual(["ready"]);
  });

  it("retries a reconnecting stream after an initial 500 response", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("server-error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('id: 10\nevent: ready\ndata: {"ok":true}\n\n'));
              controller.close();
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
      );
    globalThis.fetch = fetchMock;

    const { deckStream, setDeckAccessToken } = await import("./deck-client.js");
    setDeckAccessToken(null);
    const events: string[] = [];
    const retries: string[] = [];
    const controller = new AbortController();

    const response = await deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      retryDelayMs: 0,
      onRetry() {
        retries.push("retry");
      },
      onEvent(event) {
        if (event.event) {
          events.push(event.event);
          controller.abort();
        }
      },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retries).toEqual(["retry"]);
    expect(events).toEqual(["ready"]);
  });

  it("prefixes relative /api stream URLs with NEXT_PUBLIC_DECK_GO_API_BASE", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('id: 11\nevent: ready\ndata: {"ok":true}\n\n'));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        },
      ),
    );
    globalThis.fetch = fetchMock;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";

    const { deckStream } = await import("./deck-client.js");
    await deckStream("/api/stream", {
      onEvent() {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:19528/api/stream");
  });
});
