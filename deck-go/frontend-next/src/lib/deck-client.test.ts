import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const originalPrompt = globalThis.prompt;
const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.resetModules();
  globalThis.fetch = originalFetch;
  globalThis.prompt = originalPrompt;
  if (originalApiBase === undefined) {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
  } else {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  }
});

describe("deckFetch", () => {
  it("prefixes relative /api requests with NEXT_PUBLIC_DECK_GO_API_BASE", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";

    const { deckFetch } = await import("./deck-client.js");
    await deckFetch("/api/activity");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:19528/api/activity");
  });

  it("reuses the stored deck access token for later fetch requests", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    globalThis.fetch = fetchMock;
    globalThis.prompt = vi.fn(() => "stored-secret");

    const { deckFetch } = await import("./deck-client.js");

    await deckFetch("/api/activity");
    await deckFetch("/api/activity");

    expect(globalThis.prompt).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, init] = fetchMock.mock.calls[2];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-deck-token")).toBe("stored-secret");
  });

  it("retries once with prompted token after a 401 response", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    globalThis.fetch = fetchMock;
    globalThis.prompt = vi.fn(() => "prompted-secret");

    const { deckFetch } = await import("./deck-client.js");

    const response = await deckFetch("/api/activity");

    expect(response.status).toBe(200);
    expect(globalThis.prompt).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retryInit] = fetchMock.mock.calls[1];
    const retryHeaders = new Headers(retryInit?.headers);
    expect(retryHeaders.get("x-deck-token")).toBe("prompted-secret");
  });

  it("shares one prompted token across concurrent 401 fetch retries", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    globalThis.fetch = fetchMock;
    globalThis.prompt = vi.fn(() => "shared-secret");

    const { deckFetch } = await import("./deck-client.js");

    const [left, right] = await Promise.all([
      deckFetch("/api/activity"),
      deckFetch("/api/activity"),
    ]);

    expect(left.status).toBe(200);
    expect(right.status).toBe(200);
    expect(globalThis.prompt).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [, leftRetryInit] = fetchMock.mock.calls[2];
    const [, rightRetryInit] = fetchMock.mock.calls[3];
    expect(new Headers(leftRetryInit?.headers).get("x-deck-token")).toBe("shared-secret");
    expect(new Headers(rightRetryInit?.headers).get("x-deck-token")).toBe("shared-secret");
  });
});

describe("deckStream", () => {
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
    expect(headers.get("Accept")).toBe("text/event-stream");
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(init?.cache).toBe("no-store");
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

    const { deckStream } = await import("./deck-client.js");

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

    const { deckStream } = await import("./deck-client.js");
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
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/stream?__deck_stream_attempt=1");
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

    const { deckStream } = await import("./deck-client.js");
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
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/stream?__deck_stream_attempt=1");
  });

  it("retries a reconnecting stream after a hanging connect attempt times out", async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        async (_input, init) =>
          await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                reject(init.signal?.reason ?? new Error("aborted"));
              },
              { once: true },
            );
          }),
      )
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('id: 13\nevent: ready\ndata: {"ok":true}\n\n'));
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
    const events: string[] = [];
    const retries: string[] = [];
    const controller = new AbortController();

    const responsePromise = deckStream("/api/stream", {
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

    await vi.advanceTimersByTimeAsync(6_000);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retries).toEqual(["retry"]);
    expect(events).toEqual(["ready"]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/stream?__deck_stream_attempt=1");
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
