export type DeckEvent = {
  id?: string;
  event?: string;
  data?: string;
};

export type DeckStreamOptions = {
  token?: string | null;
  lastEventId?: number | string | null;
  signal?: AbortSignal;
  reconnect?: boolean;
  retryDelayMs?: number;
  onOpen?: () => void;
  onRetry?: () => void;
  onEvent?: (event: DeckEvent) => void;
};

type DeckTransportOptions = {
  readControlPlaneBase?: () => string | null | undefined;
  readStoredToken?: () => string | null | undefined;
  writeStoredToken?: (token: string | null) => void;
  promptMessage?: string;
};

type DeckRequestOptions = {
  init?: RequestInit;
  token?: string | null;
  lastEventId?: number | string | null;
  allowPrompt?: boolean;
};

type DeckRequestResult = {
  response: Response;
  token?: string | null;
  prompted: boolean;
};

const DEFAULT_STREAM_RETRY_MS = 1_000;
const DEFAULT_PROMPT_MESSAGE = "Enter Deck access token";
const STREAM_RETRY_QUERY_PARAM = "__deck_stream_attempt";
const DEFAULT_STREAM_CONNECT_TIMEOUT_MS = 5_000;
const BROWSER_ONLINE_SETTLE_MS = 250;

function normalizeTrimmed(raw: string | null | undefined): string | null {
  const next = (raw ?? "").trim();
  return next ? next : null;
}

function normalizeBase(raw: string | null | undefined): string {
  return (normalizeTrimmed(raw) ?? "").replace(/\/+$/, "");
}

function readResolvedToken(
  explicitToken: string | null | undefined,
  authState: { token: string | null },
  options: DeckTransportOptions,
) {
  const explicit = normalizeTrimmed(explicitToken);
  if (explicit) {
    return explicit;
  }
  if (authState.token) {
    return authState.token;
  }
  const stored = normalizeTrimmed(options.readStoredToken?.());
  if (stored) {
    authState.token = stored;
    return stored;
  }
  return null;
}

function parseSSEChunk(chunk: string, onEvent?: (event: DeckEvent) => void): void {
  const frames = chunk.split("\n\n");
  for (const frame of frames) {
    const trimmed = frame.trim();
    if (!trimmed || trimmed.startsWith(":")) {
      continue;
    }
    const event: DeckEvent = {};
    for (const line of trimmed.split("\n")) {
      if (line.startsWith("id:")) {
        event.id = line.slice(3).trim();
      } else if (line.startsWith("event:")) {
        event.event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const part = line.slice(5).trim();
        event.data = event.data ? `${event.data}\n${part}` : part;
      }
    }
    if (event.id || event.event || event.data) {
      onEvent?.(event);
    }
  }
}

function waitForReconnect(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      },
      Math.max(0, delayMs),
    );
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isBrowserOffline() {
  return typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;
}

function waitForBrowserOnline(signal?: AbortSignal): Promise<void> {
  if (
    signal?.aborted ||
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  ) {
    return Promise.resolve();
  }
  if (!isBrowserOffline()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onOnline = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.removeEventListener("online", onOnline);
      signal?.removeEventListener("abort", onAbort);
    };

    window.addEventListener("online", onOnline, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForNextStreamAttempt(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (isBrowserOffline()) {
    await waitForBrowserOnline(signal);
    if (!signal?.aborted) {
      await waitForReconnect(BROWSER_ONLINE_SETTLE_MS, signal);
    }
  }
  await waitForReconnect(delayMs, signal);
}

function withDeckStreamSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      const onAbort = () => {
        controller.abort(signal.reason);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      cleanups.push(() => signal.removeEventListener("abort", onAbort));
    }
  }

  const timeout = globalThis.setTimeout(
    () => {
      if (!controller.signal.aborted) {
        controller.abort(new DOMException("Stream connect timeout", "TimeoutError"));
      }
    },
    Math.max(0, timeoutMs),
  );
  cleanups.push(() => globalThis.clearTimeout(timeout));

  return {
    signal: controller.signal,
    cleanup() {
      for (const cleanup of cleanups) {
        cleanup();
      }
    },
  };
}

function withDeckStreamAttempt(
  input: RequestInfo | URL,
  reconnectAttempt: number,
): RequestInfo | URL {
  if (reconnectAttempt <= 0 || typeof input !== "string") {
    return input;
  }

  const hashIndex = input.indexOf("#");
  const withoutHash = hashIndex >= 0 ? input.slice(0, hashIndex) : input;
  const hash = hashIndex >= 0 ? input.slice(hashIndex) : "";
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");
  params.set(STREAM_RETRY_QUERY_PARAM, `${reconnectAttempt}`);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash}`;
}

export function createDeckTransport(options: DeckTransportOptions = {}) {
  const authState = {
    token: null as string | null,
    pendingPrompt: null as Promise<string | null> | null,
  };

  function storeDeckAccessToken(token: string | null) {
    authState.token = normalizeTrimmed(token);
    options.writeStoredToken?.(authState.token);
    return authState.token;
  }

  function resolveDeckInput(input: RequestInfo | URL): RequestInfo | URL {
    const controlPlaneBase = normalizeBase(options.readControlPlaneBase?.());
    const resolveString = (value: string) => {
      if (!value.startsWith("/api/")) {
        return value;
      }
      if (controlPlaneBase) {
        return `${controlPlaneBase}${value}`;
      }
      return value;
    };

    if (typeof input === "string") {
      return resolveString(input);
    }
    if (input instanceof URL) {
      const value = input.toString();
      return value.startsWith("/api/") ? new URL(resolveString(value)) : input;
    }
    return input;
  }

  async function promptForDeckAccessToken(): Promise<string | null> {
    if (authState.pendingPrompt) {
      return await authState.pendingPrompt;
    }
    authState.pendingPrompt = Promise.resolve().then(() => {
      if (typeof globalThis.prompt !== "function") {
        return null;
      }
      const token = globalThis.prompt(options.promptMessage ?? DEFAULT_PROMPT_MESSAGE);
      return storeDeckAccessToken(token);
    });
    try {
      return await authState.pendingPrompt;
    } finally {
      authState.pendingPrompt = null;
    }
  }

  function withDeckAuthHeaders(
    headers?: HeadersInit,
    token?: string | null,
    lastEventId?: number | string | null,
  ): Headers {
    const next = new Headers(headers);
    const authToken = readResolvedToken(token, authState, options);
    if (authToken) {
      next.set("x-deck-token", authToken);
    }
    if (lastEventId !== undefined && lastEventId !== null && `${lastEventId}`.trim()) {
      next.set("Last-Event-ID", `${lastEventId}`);
    }
    return next;
  }

  async function requestDeckResponse(
    input: RequestInfo | URL,
    requestOptions: DeckRequestOptions = {},
  ): Promise<DeckRequestResult> {
    const target = resolveDeckInput(input);
    const response = await fetch(target, {
      ...requestOptions.init,
      headers: withDeckAuthHeaders(
        requestOptions.init?.headers,
        requestOptions.token,
        requestOptions.lastEventId,
      ),
    });
    if (response.status !== 401 || requestOptions.allowPrompt === false) {
      return { response, token: requestOptions.token, prompted: false };
    }

    const promptedToken = await promptForDeckAccessToken();
    if (!promptedToken) {
      return { response, token: requestOptions.token, prompted: true };
    }

    return {
      response: await fetch(target, {
        ...requestOptions.init,
        headers: withDeckAuthHeaders(
          requestOptions.init?.headers,
          promptedToken,
          requestOptions.lastEventId,
        ),
      }),
      token: promptedToken,
      prompted: true,
    };
  }

  async function deckFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const { response } = await requestDeckResponse(input, { init });
    return response;
  }

  async function deckStream(
    input: RequestInfo | URL,
    streamOptions: DeckStreamOptions = {},
  ): Promise<Response> {
    let token = readResolvedToken(streamOptions.token, authState, options);
    let lastEventId = streamOptions.lastEventId;
    let lastResponse: Response | null = null;
    let prompted = false;
    let reconnectAttempt = 0;

    while (!streamOptions.signal?.aborted) {
      try {
        const requestSignal = withDeckStreamSignal(
          streamOptions.signal,
          DEFAULT_STREAM_CONNECT_TIMEOUT_MS,
        );
        const {
          response,
          token: nextToken,
          prompted: promptedNow,
        } = await requestDeckResponse(withDeckStreamAttempt(input, reconnectAttempt), {
          init: {
            method: "GET",
            signal: requestSignal.signal,
            cache: "no-store",
            headers: {
              Accept: "text/event-stream",
            },
          },
          token,
          lastEventId,
          allowPrompt: !prompted,
        }).finally(() => {
          requestSignal.cleanup();
        });
        prompted ||= promptedNow;
        if (nextToken !== undefined) {
          token = nextToken;
        }
        lastResponse = response;

        if (!response.ok || !response.body) {
          if (!streamOptions.reconnect || response.status === 401) {
            return response;
          }
          streamOptions.onRetry?.();
          reconnectAttempt += 1;
          await waitForNextStreamAttempt(
            streamOptions.retryDelayMs ?? DEFAULT_STREAM_RETRY_MS,
            streamOptions.signal,
          );
          continue;
        }

        streamOptions.onOpen?.();
        reconnectAttempt = 0;

        if (!streamOptions.onEvent) {
          return response;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const boundary = buffer.lastIndexOf("\n\n");
          if (boundary >= 0) {
            const chunk = buffer.slice(0, boundary + 2);
            parseSSEChunk(chunk, (event) => {
              if (event.id) {
                lastEventId = event.id;
              }
              streamOptions.onEvent?.(event);
            });
            buffer = buffer.slice(boundary + 2);
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          parseSSEChunk(buffer, (event) => {
            if (event.id) {
              lastEventId = event.id;
            }
            streamOptions.onEvent?.(event);
          });
        }

        if (!streamOptions.reconnect) {
          return response;
        }
      } catch (error) {
        if (streamOptions.signal?.aborted) {
          break;
        }
        if (!streamOptions.reconnect) {
          throw error;
        }
      }

      if (streamOptions.signal?.aborted) {
        break;
      }

      streamOptions.onRetry?.();
      reconnectAttempt += 1;
      await waitForNextStreamAttempt(
        streamOptions.retryDelayMs ?? DEFAULT_STREAM_RETRY_MS,
        streamOptions.signal,
      );
    }

    return lastResponse ?? new Response(null, { status: 499 });
  }

  return {
    deckFetch,
    deckStream,
  };
}
