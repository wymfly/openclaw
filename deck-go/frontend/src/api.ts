import type {
  DeckGoBootstrapStatusResponse,
  DeckGoChatAbortRequest,
  DeckGoChatSnapshotResponse,
  DeckGoSessionAbortResponse,
  DeckGoSessionEventsRequest,
  DeckGoSessionEventsResponse,
  DeckGoChatHistoryResponse,
  DeckGoSessionDetailResponse,
  DeckGoChatSessionCreateRequest,
  DeckGoSessionCreateResponse,
  DeckGoSessionMutationResponse,
  DeckGoSessionSendResponse,
  DeckGoChatSendRequest,
  DeckGoChannelsStatusResponse,
  DeckGoConfigSchemaLookupRequest,
  DeckGoLogStreamEvent,
  DeckGoPluginsListResponse,
  DeckGoRuntimeGatewayActionResponse,
  DeckGoServerEvent,
  DeckGoSettings,
  DeckGoSettingsResponse,
  DeckGoSettingsSaveResponse,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
} from "../../contracts/generated/ts/deck-api.generated";

const API_BASE = import.meta.env.VITE_API_BASE?.trim() || "http://127.0.0.1:19528/api";

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function getHeaders(): HeadersInit {
  const token = window.localStorage.getItem("deckGoAccessToken")?.trim();
  return {
    "Content-Type": "application/json",
    ...(token ? { "x-deck-token": token } : {}),
  };
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `settings fetch failed: ${res.status}`));
  }
  return (await res.json()) as DeckGoSettingsResponse;
}

export async function saveSettings(settings: DeckGoSettings) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    throw new Error(`settings save failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSettingsSaveResponse;
}

export async function fetchBootstrapStatus() {
  const res = await fetch(`${API_BASE}/bootstrap/status`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`bootstrap fetch failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoBootstrapStatusResponse;
}

export async function fetchRuntimeGatewayStatus() {
  const res = await fetch(`${API_BASE}/runtime/gateway`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`runtime gateway fetch failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoRuntimeGatewayActionResponse;
}

export async function startRuntimeGateway() {
  const res = await fetch(`${API_BASE}/runtime/gateway/start`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`runtime gateway start failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoRuntimeGatewayActionResponse;
}

export async function stopRuntimeGateway() {
  const res = await fetch(`${API_BASE}/runtime/gateway/stop`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`runtime gateway stop failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoRuntimeGatewayActionResponse;
}

export async function restartRuntimeGateway() {
  const res = await fetch(`${API_BASE}/runtime/gateway/restart`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`runtime gateway restart failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoRuntimeGatewayActionResponse;
}

export async function postConfigSchemaLookup(body: DeckGoConfigSchemaLookupRequest) {
  const res = await fetch(`${API_BASE}/config/schema-lookup`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`config schema lookup failed: ${res.status}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function logoutChannel(channelId: string) {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelId)}/logout`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`channel logout failed: ${res.status}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function fetchChannels() {
  const res = await fetch(`${API_BASE}/channels`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`channels fetch failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoChannelsStatusResponse;
}

export async function fetchPlugins() {
  const res = await fetch(`${API_BASE}/deck/plugins`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`plugins fetch failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoPluginsListResponse;
}

export type DeckGoLogsTailResponse = {
  cursor?: number;
  lines?: unknown[];
  reset?: boolean;
};

export async function fetchLogsTail(params?: {
  cursor?: number;
  limit?: number;
  maxBytes?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.cursor === "number") {
    query.set("cursor", String(params.cursor));
  }
  if (typeof params?.limit === "number") {
    query.set("limit", String(params.limit));
  }
  if (typeof params?.maxBytes === "number") {
    query.set("maxBytes", String(params.maxBytes));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE}/logs${suffix}`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`logs tail failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoLogsTailResponse;
}

export async function fetchSessions() {
  const res = await fetch(`${API_BASE}/sessions`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`sessions fetch failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionsListResponse;
}

export async function fetchSessionPreviews(keys: string[]) {
  const res = await fetch(`${API_BASE}/chat/sessions/preview`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ keys }),
  });
  if (!res.ok) {
    throw new Error(`session preview failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionsPreviewResponse;
}

function buildSessionQuery(params: { sessionKey: string; agentId?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params.agentId) {
    search.set("agentId", params.agentId);
  }
  if (typeof params.limit === "number") {
    search.set("limit", String(params.limit));
  }
  return search.toString();
}

export async function fetchSessionDetail(params: {
  sessionKey: string;
  agentId?: string;
  limit?: number;
}) {
  const query = buildSessionQuery(params);
  const suffix = query ? `?${query}` : "";
  const res = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(params.sessionKey)}${suffix}`,
    {
      headers: getHeaders(),
    },
  );
  if (!res.ok) {
    throw new Error(`session detail failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionDetailResponse;
}

export async function fetchChatSnapshot(params: {
  sessionKey: string;
  agentId?: string;
  limit?: number;
}) {
  const query = new URLSearchParams({ sessionKey: params.sessionKey });
  const detailQuery = buildSessionQuery(params);
  if (detailQuery) {
    for (const [key, value] of new URLSearchParams(detailQuery).entries()) {
      query.set(key, value);
    }
  }
  const res = await fetch(`${API_BASE}/chat/snapshot?${query.toString()}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`chat snapshot failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoChatSnapshotResponse;
}

export async function fetchChatHistory(params: { sessionKey: string; limit?: number }) {
  const query = new URLSearchParams({ sessionKey: params.sessionKey });
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  const res = await fetch(`${API_BASE}/chat/history?${query.toString()}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`chat history failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoChatHistoryResponse;
}

export async function createChatSession(body: DeckGoChatSessionCreateRequest) {
  const res = await fetch(`${API_BASE}/chat/sessions/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`chat session create failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionCreateResponse;
}

export async function sendChatMessage(body: DeckGoChatSendRequest) {
  const res = await fetch(`${API_BASE}/chat/send`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`chat send failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionSendResponse;
}

export async function abortChatRun(body: DeckGoChatAbortRequest) {
  const res = await fetch(`${API_BASE}/chat/abort`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`chat abort failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionAbortResponse;
}

export async function resetSession(body: { sessionKey: string; reason?: "new" | "reset" }) {
  const res = await fetch(`${API_BASE}/chat/sessions/reset`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`session reset failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionMutationResponse;
}

export async function clearSession(body: { sessionKey: string }) {
  const res = await fetch(`${API_BASE}/chat/sessions/clear`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`session clear failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionMutationResponse;
}

export async function patchSession(body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/chat/sessions/patch`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`session patch failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionMutationResponse;
}

export async function setSessionEventsSubscription(body: DeckGoSessionEventsRequest) {
  const res = await fetch(`${API_BASE}/chat/session-events`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`session events request failed: ${res.status}`);
  }
  return (await res.json()) as DeckGoSessionEventsResponse;
}

export function persistAccessToken(token: string) {
  window.localStorage.setItem("deckGoAccessToken", token);
}

function parseSSEChunk(chunk: string, onEvent: (event: DeckGoServerEvent) => void) {
  const frames = chunk.split("\n\n");
  for (const frame of frames) {
    const trimmed = frame.trim();
    if (!trimmed || trimmed.startsWith(":")) {
      continue;
    }
    const event: DeckGoServerEvent = {};
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
    if (event.data) {
      try {
        event.json = JSON.parse(event.data);
      } catch {
        // keep raw string payload when data is not JSON
      }
    }
    if (event.id || event.event || event.data) {
      onEvent(event);
    }
  }
}

type StreamParams<TEvent extends DeckGoServerEvent> = {
  signal: AbortSignal;
  onEvent: (event: TEvent) => void;
  retryDelayMs?: number;
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "error") => void;
  initialLastEventId?: string;
};

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function streamSSE<TEvent extends DeckGoServerEvent>(
  url: string,
  params: StreamParams<TEvent>,
): Promise<void> {
  let lastEventId: string | undefined = params.initialLastEventId?.trim() || undefined;
  let firstConnection = true;

  while (!params.signal.aborted) {
    params.onStatusChange?.(firstConnection ? "connecting" : "reconnecting");
    const headers: Record<string, string> = {
      ...(getHeaders() as Record<string, string>),
    };
    if (lastEventId) {
      headers["Last-Event-ID"] = lastEventId;
    }
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: params.signal,
    });
    if (!res.ok || !res.body) {
      params.onStatusChange?.("error");
      throw new Error(`stream failed: ${res.status}`);
    }
    params.onStatusChange?.("connected");
    firstConnection = false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!params.signal.aborted) {
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
          params.onEvent(event as TEvent);
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
        params.onEvent(event as TEvent);
      });
    }

    if (params.signal.aborted) {
      return;
    }
    await wait(params.retryDelayMs ?? 1000, params.signal);
  }
}

export async function streamEvents(params: StreamParams<DeckGoServerEvent>): Promise<void> {
  return streamSSE(`${API_BASE}/stream`, params);
}

export async function streamLogEvents(params: StreamParams<DeckGoLogStreamEvent>): Promise<void> {
  return streamSSE(`${API_BASE}/logs/stream`, params);
}
