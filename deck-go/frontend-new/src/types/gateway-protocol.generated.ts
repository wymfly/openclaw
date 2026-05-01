export interface TranscriptMessage {
  id?: string;
  role?: string;
  content?: unknown;
  timestamp?: number;
  __openclaw?: {
    id?: string;
  };
}

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq?: number;
  state: "delta" | "final" | "error" | "aborted";
  errorMessage?: string;
  message?: {
    id?: string;
    role: "user" | "assistant" | "system";
    content: Array<Record<string, unknown>>;
    timestamp?: number;
  };
}

export interface AgentEventPayload {
  sessionKey?: string;
  runId?: string;
  stream: "tool" | "thinking" | "lifecycle";
  seq?: number;
  ts?: number;
  data: Record<string, unknown>;
}

export interface SessionToolEventPayload {
  sessionKey: string;
  runId?: string;
  stream: "tool";
  seq?: number;
  ts?: number;
  data: Record<string, unknown>;
}

export interface SessionMessageEventPayload {
  sessionKey: string;
  message?: TranscriptMessage | Record<string, unknown>;
  messageId?: string;
  messageSeq?: number;
  updatedAt?: number;
  status?: string;
}

export interface SessionsChangedEventPayload {
  sessionKey: string;
  phase?: string;
  ts?: number;
  runId?: string;
  reason?: string;
  status?: string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  fastMode?: boolean;
  totalTokens?: number;
  estimatedCostUsd?: number;
  model?: string;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  responseUsage?: string;
  sendPolicy?: string;
  contextTokens?: number;
  compacted?: boolean;
  errorMessage?: string;
}
