import { deckFetch } from "@/lib/deck-client";
import type { A2UIState, ApprovalRequest, SessionMeta } from "@/stores/chat-types";

type RawSessionMeta = {
  key?: string;
  sessionKey?: string;
  agentId?: string;
  title?: string;
  displayName?: string;
  lastMessage?: string;
  lastMessagePreview?: string;
  updatedAt?: number;
  status?: string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  model?: string;
  modelProvider?: string;
  thinkingLevel?: string;
  fastMode?: boolean;
  verboseLevel?: string;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  contextTokens?: number;
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  spawnedWorkspaceDir?: string;
};

// Re-use the canonical ErrorBody from lib/errors (with Partial for unknown JSON parsing)
type ApiErrorBody = Partial<import("@/lib/errors").ErrorBody>;

export type ChatAttachmentPayload = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content: string;
};

export type SessionCreateResponse = {
  ok?: boolean;
  key: string;
  sessionId?: string;
  entry?: Record<string, unknown>;
  runStarted?: boolean;
  runId?: string;
  status?: string;
  messageSeq?: number;
  interruptedActiveRun?: boolean;
  runError?: unknown;
};

export type SessionSendResponse = {
  runId?: string;
  status: "started" | "in_flight";
  messageSeq?: number;
  interruptedActiveRun?: boolean;
};

export type SessionAbortResponse = {
  ok?: boolean;
  abortedRunId?: string | null;
  status?: "aborted" | "no-active-run";
};

export type SessionMutationResponse = {
  ok?: boolean;
  key: string;
  entry?: Record<string, unknown>;
};

export type InitialSessionSendPlan =
  | { kind: "started" }
  | { kind: "send" }
  | { kind: "error"; error: string };

export type ChatSnapshot = {
  messages: Array<{ role?: string; content?: unknown; timestamp?: number }>;
  meta: SessionMeta | null;
  activeApproval: ApprovalRequest | null;
  a2uiState: A2UIState | null;
};

type PersistedA2UIState = Omit<A2UIState, "bridgeStatus" | "treeData">;

async function parseResponseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readApiError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as ApiErrorBody).error === "string") {
    return (body as ApiErrorBody).error as string;
  }
  return `Request failed (${response.status})`;
}

export function normalizeGatewayError(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
    const maybeError = (error as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError;
    }
  }
  return "Request failed";
}

export function resolveInitialSessionSendPlan(params: {
  hasAttachments: boolean;
  runStarted?: boolean;
  runError?: unknown;
}): InitialSessionSendPlan {
  if (params.hasAttachments) {
    return { kind: "send" };
  }
  if (params.runError !== undefined && params.runError !== null) {
    return {
      kind: "error",
      error: normalizeGatewayError(params.runError),
    };
  }
  if (params.runStarted) {
    return { kind: "started" };
  }
  return { kind: "send" };
}

function normalizeSessionMeta(raw: RawSessionMeta, fallbackAgentId?: string): SessionMeta {
  return {
    key: raw.key ?? raw.sessionKey ?? "",
    agentId: raw.agentId ?? fallbackAgentId ?? "main",
    title: raw.title ?? raw.displayName,
    updatedAt: raw.updatedAt ?? Date.now(),
    lastMessagePreview: raw.lastMessagePreview ?? raw.lastMessage,
    status: raw.status,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    runtimeMs: raw.runtimeMs,
    model: raw.model,
    modelProvider: raw.modelProvider,
    thinkingLevel: raw.thinkingLevel,
    fastMode: raw.fastMode,
    verboseLevel: raw.verboseLevel,
    totalTokens: raw.totalTokens,
    totalTokensFresh: raw.totalTokensFresh,
    estimatedCostUsd: raw.estimatedCostUsd,
    parentSessionKey: raw.parentSessionKey,
    childSessions: raw.childSessions,
    contextTokens: raw.contextTokens,
    subagentRole: raw.subagentRole,
    subagentControlScope: raw.subagentControlScope,
    spawnedWorkspaceDir: raw.spawnedWorkspaceDir,
  };
}

function sanitizeA2UIState(state: A2UIState | null): PersistedA2UIState | null {
  if (!state) {
    return null;
  }
  const { bridgeStatus: _bridgeStatus, treeData: _treeData, ...rest } = state;
  void _bridgeStatus;
  void _treeData;
  return rest;
}

export async function fetchSessionList(agentId?: string): Promise<SessionMeta[]> {
  const params = new URLSearchParams();
  if (agentId) {
    params.set("agentId", agentId);
  }
  const suffix = params.size > 0 ? `?${params}` : "";
  const response = await deckFetch(`/api/chat/sessions${suffix}`);
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const data = await parseResponseJson<RawSessionMeta[] | { sessions?: RawSessionMeta[] } | null>(
    response,
  );
  const sessions = Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : [];
  return sessions.map((session) => normalizeSessionMeta(session, agentId));
}

export async function fetchChatSnapshot(params: {
  sessionKey: string;
  agentId?: string;
  limit?: number;
}): Promise<ChatSnapshot> {
  const query = new URLSearchParams({ sessionKey: params.sessionKey });
  if (params.agentId) {
    query.set("agentId", params.agentId);
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  const response = await deckFetch(`/api/chat/snapshot?${query.toString()}`);
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const data = await parseResponseJson<{
    messages?: Array<{ role?: string; content?: unknown; timestamp?: number }>;
    meta?: RawSessionMeta | null;
    activeApproval?: ApprovalRequest | null;
    a2uiState?: A2UIState | null;
  }>(response);
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    meta: data.meta ? normalizeSessionMeta(data.meta, params.agentId) : null,
    activeApproval: data.activeApproval ?? null,
    a2uiState: data.a2uiState ?? null,
  };
}

export async function setSessionMessageSubscription(params: {
  sessionKey: string;
  subscribed: boolean;
}): Promise<void> {
  const response = await deckFetch("/api/chat/session-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: params.subscribed ? "subscribe" : "unsubscribe",
      sessionKey: params.sessionKey,
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function patchSession(
  sessionKey: string,
  patch: {
    label?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
  },
): Promise<boolean> {
  try {
    const res = await deckFetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, ...patch }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createChatSession(params: {
  agentId?: string;
  message?: string;
  model?: string;
  label?: string;
  parentSessionKey?: string;
}): Promise<SessionCreateResponse> {
  const response = await deckFetch("/api/chat/sessions/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return parseResponseJson<SessionCreateResponse>(response);
}

export async function sendChatMessage(params: {
  sessionKey: string;
  message?: string;
  thinking?: string;
  idempotencyKey?: string;
  attachments?: ChatAttachmentPayload[];
}): Promise<SessionSendResponse> {
  const response = await deckFetch("/api/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return parseResponseJson<SessionSendResponse>(response);
}

export async function abortChatRun(params: {
  sessionKey: string;
  runId?: string;
}): Promise<SessionAbortResponse> {
  const response = await deckFetch("/api/chat/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return parseResponseJson<SessionAbortResponse>(response);
}

export async function patchChatSession(params: {
  sessionKey: string;
  model?: string;
  thinkingLevel?: string;
  fastMode?: boolean;
  verboseLevel?: string;
}): Promise<Response> {
  const response = await deckFetch("/api/chat/sessions/patch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response;
}

export async function compactChatSession(sessionKey: string): Promise<Response> {
  const response = await deckFetch("/api/chat/compact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response;
}

export async function resetChatSession(sessionKey: string): Promise<SessionMutationResponse> {
  const response = await deckFetch("/api/chat/sessions/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return parseResponseJson<SessionMutationResponse>(response);
}

export async function clearChatSession(sessionKey: string): Promise<SessionMutationResponse> {
  const response = await deckFetch("/api/chat/sessions/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return parseResponseJson<SessionMutationResponse>(response);
}

export async function persistChatProjection(params: {
  sessionKey: string;
  a2uiState: A2UIState | null;
}): Promise<void> {
  const response = await deckFetch("/api/chat/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionKey: params.sessionKey,
      a2uiState: sanitizeA2UIState(params.a2uiState),
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function setCanvasBridgeReady(params: {
  sessionKey: string;
  ready: boolean;
}): Promise<void> {
  const response = await deckFetch("/api/deck/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: params.ready ? "ready" : "unready",
      sessionKey: params.sessionKey,
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function resolveCanvasEval(params: {
  evalId: string;
  result: unknown;
}): Promise<void> {
  const response = await deckFetch("/api/deck/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "resolve",
      evalId: params.evalId,
      result: params.result,
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}
