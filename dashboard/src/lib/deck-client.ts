type DeckEvent = {
  id?: string;
  event?: string;
  data?: string;
};

type DeckStreamOptions = {
  token?: string | null;
  lastEventId?: number | string | null;
  signal?: AbortSignal;
  reconnect?: boolean;
  retryDelayMs?: number;
  /** Called when a stream connection is established (response.ok received). */
  onOpen?: () => void;
  /** Called when the stream ends and a reconnect will be attempted. */
  onRetry?: () => void;
  onEvent?: (event: DeckEvent) => void;
};

let deckAccessToken: string | null = null;
let pendingTokenPrompt: Promise<string | null> | null = null;
const DEFAULT_STREAM_RETRY_MS = 1_000;

export function getDeckAccessToken(): string | null {
  return deckAccessToken;
}

export function setDeckAccessToken(token: string | null): void {
  deckAccessToken = token?.trim() ? token.trim() : null;
}

async function promptForDeckAccessToken(): Promise<string | null> {
  if (pendingTokenPrompt) {
    return await pendingTokenPrompt;
  }
  pendingTokenPrompt = Promise.resolve().then(() => {
    if (typeof globalThis.prompt !== "function") {
      return null;
    }
    const token = globalThis.prompt("Enter Deck access token");
    setDeckAccessToken(token);
    return getDeckAccessToken();
  });
  try {
    return await pendingTokenPrompt;
  } finally {
    pendingTokenPrompt = null;
  }
}

function withDeckAuthHeaders(
  headers?: HeadersInit,
  token?: string | null,
  lastEventId?: number | string | null,
): Headers {
  const next = new Headers(headers);
  const authToken = token ?? deckAccessToken;
  if (authToken) {
    next.set("x-deck-token", authToken);
  }
  if (lastEventId !== undefined && lastEventId !== null && `${lastEventId}`.trim()) {
    next.set("Last-Event-ID", `${lastEventId}`);
  }
  return next;
}

export async function deckFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = withDeckAuthHeaders(init?.headers);
  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401) {
    return response;
  }

  const promptedToken = await promptForDeckAccessToken();
  if (!promptedToken) {
    return response;
  }

  return await fetch(input, {
    ...init,
    headers: withDeckAuthHeaders(init?.headers, promptedToken),
  });
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

export async function deckStream(
  input: RequestInfo | URL,
  options: DeckStreamOptions = {},
): Promise<Response> {
  let token = options.token ?? deckAccessToken;
  let lastEventId = options.lastEventId;
  let lastResponse: Response | null = null;
  let prompted = false;

  while (!options.signal?.aborted) {
    try {
      const headers = withDeckAuthHeaders(undefined, token, lastEventId);
      const response = await fetch(input, {
        method: "GET",
        headers,
        signal: options.signal,
      });
      lastResponse = response;

      if (response.status === 401 && !prompted) {
        prompted = true;
        token = await promptForDeckAccessToken();
        if (token) {
          continue;
        }
      }

      if (!response.ok || !response.body) {
        return response;
      }

      options.onOpen?.();

      if (!options.onEvent) {
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
            options.onEvent?.(event);
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
          options.onEvent?.(event);
        });
      }

      if (!options.reconnect) {
        return response;
      }
    } catch (error) {
      if (options.signal?.aborted) {
        break;
      }
      if (!options.reconnect) {
        throw error;
      }
    }

    options.onRetry?.();
    await waitForReconnect(options.retryDelayMs ?? DEFAULT_STREAM_RETRY_MS, options.signal);
  }

  return lastResponse ?? new Response(null, { status: 499 });
}
