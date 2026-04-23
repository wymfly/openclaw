import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const originalPrompt = globalThis.prompt;
const originalViteApiBase = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.VITE_API_BASE;
const originalViteDeckBase = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.VITE_DECK_GO_API_BASE;

function setProcessEnv(name: string, value: string | undefined) {
  const holder = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  holder.process ??= { env: {} };
  holder.process.env ??= {};
  if (value === undefined) {
    delete holder.process.env[name];
    return;
  }
  holder.process.env[name] = value;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  globalThis.fetch = originalFetch;
  globalThis.prompt = originalPrompt;
  setProcessEnv("VITE_API_BASE", originalViteApiBase);
  setProcessEnv("VITE_DECK_GO_API_BASE", originalViteDeckBase);
});

describe("deck-go/frontend transport parity", () => {
  it("prefixes relative /api requests with VITE_API_BASE when no host base is provided", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;
    setProcessEnv("VITE_DECK_GO_API_BASE", undefined);
    setProcessEnv("VITE_API_BASE", "http://127.0.0.1:19528/api");

    const { deckFetch } = await import("../../../frontend/src/lib/deck-client.js");
    await deckFetch("/api/activity");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:19528/api/activity");
  });

  it("prefers VITE_DECK_GO_API_BASE for relative /api requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;
    setProcessEnv("VITE_DECK_GO_API_BASE", "http://127.0.0.1:19528");
    setProcessEnv("VITE_API_BASE", "http://127.0.0.1:19528/api");

    const { deckFetch } = await import("../../../frontend/src/lib/deck-client.js");
    await deckFetch("/api/activity");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:19528/api/activity");
  });

  it("retries once with a prompted token after a 401 response", async () => {
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
    globalThis.prompt = vi.fn(() => "vite-secret");

    const { deckFetch } = await import("../../../frontend/src/lib/deck-client.js");
    const response = await deckFetch("/api/activity");

    expect(response.status).toBe(200);
    expect(globalThis.prompt).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("x-deck-token")).toBe(
      "vite-secret",
    );
  });

  it("deduplicates concurrent 401 prompts for fetch retries", async () => {
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
    globalThis.prompt = vi.fn(() => "shared-vite-secret");

    const { deckFetch } = await import("../../../frontend/src/lib/deck-client.js");
    await Promise.all([deckFetch("/api/activity"), deckFetch("/api/activity")]);

    expect(globalThis.prompt).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("x-deck-token")).toBe(
      "shared-vite-secret",
    );
    expect(new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get("x-deck-token")).toBe(
      "shared-vite-secret",
    );
  });

  it("reconnects SSE streams and preserves Last-Event-ID updates", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("server-error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('id: 12\nevent: ready\ndata: {"ok":true}\n\n'));
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

    const { deckStream } = await import("../../../frontend/src/lib/deck-client.js");
    const controller = new AbortController();
    const retries: string[] = [];

    const response = await deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      retryDelayMs: 0,
      lastEventId: "9",
      onRetry() {
        retries.push("retry");
      },
      onEvent(event) {
        if (event.event === "ready") {
          controller.abort();
        }
      },
    });

    expect(response.status).toBe(200);
    expect(retries).toEqual(["retry"]);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Last-Event-ID")).toBe("9");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Last-Event-ID")).toBe("9");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Accept")).toBe(
      "text/event-stream",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe("no-store");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://127.0.0.1:19528/api/stream?__deck_stream_attempt=1",
    );
  });
});
