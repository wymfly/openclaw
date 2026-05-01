import { createLocalStore } from "./create-local-store";

export interface SessionEntry {
  key: string;
  status?: string;
  totalTokens?: number;
  estimatedCostUsd?: number;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  model?: string;
  fastMode?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: "off" | "on" | "stream";
  responseUsage?: "off" | "tokens" | "full";
  sendPolicy?: "allow" | "deny";
  contextTokens?: number;
  compactionCount?: number;
  tokensIn: number;
  tokensOut: number;
}

export type SessionsChangedPayload = {
  sessionKey: string;
  status?: string;
  totalTokens?: number;
  estimatedCostUsd?: number;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  model?: string;
  fastMode?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  responseUsage?: string;
  sendPolicy?: string;
  contextTokens?: number;
  compactionCount?: number;
  compacted?: boolean;
};

function normalizeReasoning(v: string | undefined): SessionEntry["reasoningLevel"] {
  return v === "off" || v === "on" || v === "stream" ? v : undefined;
}

function normalizeUsage(v: string | undefined): SessionEntry["responseUsage"] {
  if (v === "on") {
    return "full";
  }
  return v === "off" || v === "tokens" || v === "full" ? v : undefined;
}

function normalizeSendPolicy(v: string | undefined): SessionEntry["sendPolicy"] {
  return v === "allow" || v === "deny" ? v : undefined;
}

interface SessionsState {
  sessions: SessionEntry[];
  applySessionChangedEvent: (payload: SessionsChangedPayload) => void;
}

export const useSessionsStore = createLocalStore<SessionsState>((set) => ({
  sessions: [],
  applySessionChangedEvent: (payload) =>
    set((state) => {
      const index = state.sessions.findIndex((entry) => entry.key === payload.sessionKey);
      const patch: Partial<SessionEntry> = {
        ...(payload.status ? { status: payload.status } : {}),
        ...(typeof payload.totalTokens === "number" ? { totalTokens: payload.totalTokens } : {}),
        ...(typeof payload.estimatedCostUsd === "number"
          ? { estimatedCostUsd: payload.estimatedCostUsd }
          : {}),
        ...(typeof payload.startedAt === "number" ? { startedAt: payload.startedAt } : {}),
        ...(typeof payload.endedAt === "number" ? { endedAt: payload.endedAt } : {}),
        ...(typeof payload.runtimeMs === "number" ? { runtimeMs: payload.runtimeMs } : {}),
        ...(typeof payload.model === "string" ? { model: payload.model } : {}),
        ...(typeof payload.fastMode === "boolean" ? { fastMode: payload.fastMode } : {}),
        ...(typeof payload.thinkingLevel === "string"
          ? { thinkingLevel: payload.thinkingLevel }
          : {}),
        ...(typeof payload.verboseLevel === "string" ? { verboseLevel: payload.verboseLevel } : {}),
        ...(normalizeReasoning(payload.reasoningLevel)
          ? { reasoningLevel: normalizeReasoning(payload.reasoningLevel) }
          : {}),
        ...(normalizeUsage(payload.responseUsage)
          ? { responseUsage: normalizeUsage(payload.responseUsage) }
          : {}),
        ...(normalizeSendPolicy(payload.sendPolicy)
          ? { sendPolicy: normalizeSendPolicy(payload.sendPolicy) }
          : {}),
        ...(typeof payload.contextTokens === "number"
          ? { contextTokens: payload.contextTokens }
          : {}),
        ...(typeof payload.compactionCount === "number"
          ? { compactionCount: payload.compactionCount }
          : {}),
      };

      if (payload.compacted === true) {
        patch.tokensIn = 0;
        patch.tokensOut = 0;
        patch.totalTokens = patch.totalTokens ?? 0;
        if (typeof patch.compactionCount !== "number" && index >= 0) {
          patch.compactionCount = (state.sessions[index].compactionCount ?? 0) + 1;
        }
      }

      if (index < 0) {
        return {
          sessions: [
            ...state.sessions,
            {
              key: payload.sessionKey,
              tokensIn: 0,
              tokensOut: 0,
              ...patch,
            },
          ],
        };
      }

      const sessions = [...state.sessions];
      sessions[index] = { ...sessions[index], ...patch };
      return { sessions };
    }),
}));
