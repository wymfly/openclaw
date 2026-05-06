import {
  abortChatRun,
  clearSession,
  compactChatSession,
  createChatSession,
  deleteSession,
  fetchChatSnapshot as fetchChatSnapshotRequest,
  fetchCompactionCheckpoints,
  fetchSessionPreviews as fetchSessionPreviewsRequest,
  fetchSessions,
  patchChatSession,
  patchSession as patchSessionRequest,
  persistChatProjection,
  resolveCanvasEval,
  resetSession,
  sendChatMessage,
  setCanvasBridgeReady,
  setSessionEventsSubscription,
  steerChatSession,
  type DeckGoCompactionCheckpoint,
  type DeckGoCompactionListResponse,
} from "@/api";
import { normalizeGatewayUserDisplayText } from "@/lib/transcript-adapter";
import type {
  A2UIState,
  ApprovalRequest,
  SessionMeta,
  SessionPreviewOverlay,
} from "@/stores/chat-types";

type RawSessionMeta = {
  key?: string;
  sessionKey?: string;
  agentId?: string;
  label?: string;
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
  reasoningLevel?: string | null;
  responseUsage?: string | null;
  sendPolicy?: string | null;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  contextTokens?: number;
  compactionCount?: number;
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  spawnedWorkspaceDir?: string;
};

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

const REASONING_VALUES = new Set(["off", "on", "stream"]);
function normalizeReasoning(v: string | null | undefined): "off" | "on" | "stream" | undefined {
  if (!v) {
    return undefined;
  }
  return REASONING_VALUES.has(v) ? (v as "off" | "on" | "stream") : undefined;
}

const USAGE_VALUES = new Set(["off", "tokens", "full"]);
function normalizeUsage(v: string | null | undefined): "off" | "tokens" | "full" | undefined {
  if (!v) {
    return undefined;
  }
  if (v === "on") {
    return "full";
  }
  return USAGE_VALUES.has(v) ? (v as "off" | "tokens" | "full") : undefined;
}

function normalizeSendPolicy(v: string | null | undefined): "allow" | "deny" | undefined {
  if (v === "allow" || v === "deny") {
    return v;
  }
  return undefined;
}

function normalizeSessionDisplayText(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  return normalizeGatewayUserDisplayText(value) || undefined;
}

function normalizeSessionMeta(raw: RawSessionMeta, fallbackAgentId?: string): SessionMeta {
  return {
    key: raw.key ?? raw.sessionKey ?? "",
    agentId: raw.agentId ?? fallbackAgentId ?? "main",
    label: normalizeSessionDisplayText(raw.label),
    title: normalizeSessionDisplayText(raw.title ?? raw.displayName),
    updatedAt: raw.updatedAt ?? Date.now(),
    lastMessagePreview: normalizeSessionDisplayText(raw.lastMessagePreview ?? raw.lastMessage),
    status: raw.status,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    runtimeMs: raw.runtimeMs,
    model: raw.model,
    modelProvider: raw.modelProvider,
    thinkingLevel: raw.thinkingLevel,
    fastMode: raw.fastMode,
    verboseLevel: raw.verboseLevel,
    reasoningLevel: normalizeReasoning(raw.reasoningLevel),
    responseUsage: normalizeUsage(raw.responseUsage),
    sendPolicy: normalizeSendPolicy(raw.sendPolicy),
    totalTokens: raw.totalTokens,
    totalTokensFresh: raw.totalTokensFresh,
    estimatedCostUsd: raw.estimatedCostUsd,
    parentSessionKey: raw.parentSessionKey,
    childSessions: raw.childSessions,
    contextTokens: raw.contextTokens,
    compactionCount: raw.compactionCount,
    subagentRole: raw.subagentRole,
    subagentControlScope: raw.subagentControlScope,
    spawnedWorkspaceDir: raw.spawnedWorkspaceDir,
  };
}

function buildSessionPreviewText(items: Array<{ text?: string }> | undefined): string {
  return (items ?? [])
    .map((item) => normalizeGatewayUserDisplayText(item.text?.trim() ?? ""))
    .filter(Boolean)
    .join(" · ")
    .trim();
}

export async function fetchSessionList(agentId?: string): Promise<SessionMeta[]> {
  const response = await fetchSessions(agentId ? { agentId } : undefined);
  return (response.sessions ?? []).map((session) =>
    normalizeSessionMeta(session as RawSessionMeta, agentId),
  );
}

export async function fetchSessionPreviews(
  keys: string[],
): Promise<Record<string, SessionPreviewOverlay | null>> {
  if (keys.length === 0) {
    return {};
  }

  const data = await fetchSessionPreviewsRequest(keys);
  const overlays: Record<string, SessionPreviewOverlay | null> = {};
  for (const preview of data.previews ?? []) {
    const text = buildSessionPreviewText(preview.items);
    overlays[preview.key] = text
      ? {
          text,
          updatedAt: data.ts ?? Date.now(),
          source: "remote",
        }
      : null;
  }
  return overlays;
}

export async function fetchChatSnapshot(params: {
  sessionKey: string;
  agentId?: string;
  limit?: number;
}): Promise<ChatSnapshot> {
  const data = await fetchChatSnapshotRequest(params);
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    meta: data.session
      ? normalizeSessionMeta(data.session as RawSessionMeta, params.agentId)
      : null,
    activeApproval: (data.activeApproval as ApprovalRequest | null | undefined) ?? null,
    a2uiState: (data.a2uiState as A2UIState | null | undefined) ?? null,
  };
}

export async function setSessionMessageSubscription(params: {
  sessionKey: string;
  subscribed: boolean;
}): Promise<void> {
  await setSessionEventsSubscription({
    action: params.subscribed ? "subscribe" : "unsubscribe",
    sessionKey: params.sessionKey,
  });
}

export async function patchSession(
  sessionKey: string,
  patch: {
    label?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
    responseUsage?: string | null;
    sendPolicy?: string | null;
  },
): Promise<boolean> {
  try {
    await patchSessionRequest({ sessionKey, ...patch });
    return true;
  } catch {
    return false;
  }
}

export async function resetChatSession(sessionKey: string): Promise<SessionMutationResponse> {
  return (await resetSession({ sessionKey })) as SessionMutationResponse;
}

export async function clearChatSession(sessionKey: string): Promise<SessionMutationResponse> {
  return (await clearSession({ sessionKey })) as SessionMutationResponse;
}

export async function deleteChatSession(
  sessionKey: string,
  agentId?: string | null,
): Promise<SessionMutationResponse> {
  return (await deleteSession({ sessionKey, agentId })) as SessionMutationResponse;
}

export type CompactionCheckpoint = DeckGoCompactionCheckpoint;
export type CompactionListResponse = DeckGoCompactionListResponse;

export async function fetchCompactionList(sessionKey: string): Promise<CompactionCheckpoint[]> {
  const data = await fetchCompactionCheckpoints(sessionKey);
  return Array.isArray(data.checkpoints) ? data.checkpoints : [];
}

export {
  abortChatRun,
  clearSession,
  compactChatSession,
  createChatSession,
  patchChatSession,
  persistChatProjection,
  resolveCanvasEval,
  sendChatMessage,
  setCanvasBridgeReady,
  steerChatSession,
};
