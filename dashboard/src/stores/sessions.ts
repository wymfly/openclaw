import { create } from "zustand";
import { normalizeTranscriptMessages } from "@/lib/transcript-adapter";
import {
  getCachedTranscript,
  setCachedTranscript,
  invalidateTranscript,
} from "@/lib/transcript-cache";
import type { ChatMessage, ContentBlock } from "@/stores/chat-types";
import type { SessionsChangedEventPayload } from "@/types/gateway-protocol.generated";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionKind = "direct" | "group" | "global" | "unknown";

export interface SessionEntry {
  key: string;
  kind: SessionKind;
  model: string;
  tokensIn: number;
  tokensOut: number;
  contextWindow: number;
  updatedAt: number;
  compactionCount?: number;
  // Patchable fields
  label?: string;
  thinkingLevel?: string;
  fastMode?: boolean;
  // Extended lifecycle fields (populated by sessions.changed events)
  status?: string;
  totalTokens?: number;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  spawnedWorkspaceDir?: string;
}

export type HistoryMessage = ChatMessage;
export type SessionsChangedPayload = SessionsChangedEventPayload & {
  reason?: string;
  compacted?: boolean;
  compactionCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  subagentRole?: SessionEntry["subagentRole"];
  subagentControlScope?: SessionEntry["subagentControlScope"];
  spawnedWorkspaceDir?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blockToText(block: ContentBlock): string {
  if (block.type === "text" || block.type === "thinking") {
    return block.text;
  }
  if (block.type === "tool_use") {
    return `${block.name} ${JSON.stringify(block.input)}`;
  }
  if (block.type === "tool_result") {
    if (typeof block.content === "string") {
      return block.content;
    }
    return block.content
      .map((entry) => blockToText(entry))
      .filter(Boolean)
      .join("\n");
  }
  if (block.type === "image") {
    return block.fileName ?? "image";
  }
  if (block.type === "file") {
    return block.fileName;
  }
  if (block.type === "canvas") {
    return block.title ?? "embed";
  }
  return block.rawType;
}

export function historyMessageToPlainText(message: HistoryMessage): string {
  return message.content
    .map((block) => blockToText(block))
    .filter(Boolean)
    .join("\n");
}

/** Derive session kind from the key naming convention. */
function inferKind(key: string): SessionKind {
  if (key.startsWith("direct:") || key.includes(":direct:")) {
    return "direct";
  }
  if (key.startsWith("group:") || key.includes(":group:")) {
    return "group";
  }
  if (key.startsWith("global:") || key.includes(":global:")) {
    return "global";
  }
  return "unknown";
}

/** Normalize a raw session entry from the gateway. */
function normalizeSession(raw: Record<string, unknown>): SessionEntry {
  const keyVal = raw.key ?? raw.sessionKey ?? "";
  const key = typeof keyVal === "string" ? keyVal : JSON.stringify(keyVal);
  const modelVal = raw.model ?? "";
  return {
    key,
    kind: (raw.kind as SessionKind) ?? inferKind(key),
    model: typeof modelVal === "string" ? modelVal : JSON.stringify(modelVal),
    tokensIn: Number(raw.inputTokens ?? raw.tokensIn ?? 0),
    tokensOut: Number(raw.outputTokens ?? raw.tokensOut ?? 0),
    contextWindow: Number(raw.contextTokens ?? raw.contextWindow ?? 0),
    updatedAt: Number(raw.updatedAt ?? raw.lastActivityAt ?? 0),
    totalTokens: typeof raw.totalTokens === "number" ? raw.totalTokens : undefined,
    estimatedCostUsd: typeof raw.estimatedCostUsd === "number" ? raw.estimatedCostUsd : undefined,
    compactionCount: typeof raw.compactionCount === "number" ? raw.compactionCount : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    label: typeof raw.label === "string" ? raw.label : undefined,
    thinkingLevel: typeof raw.thinkingLevel === "string" ? raw.thinkingLevel : undefined,
    fastMode: typeof raw.fastMode === "boolean" ? raw.fastMode : undefined,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface SessionsFetchOpts {
  search?: string;
  limit?: number;
  activeMinutes?: number;
}

/** Fields that can be modified via sessions.patch. */
export interface SessionPatchFields {
  label?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
}

interface SessionsState {
  sessions: SessionEntry[];
  selectedKey: string | null;
  history: HistoryMessage[];
  loading: boolean;
  error: string | null;

  fetchSessions: (opts?: SessionsFetchOpts) => Promise<void>;
  selectSession: (key: string | null) => void;
  fetchHistory: (sessionKey: string) => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;
  patchSession: (sessionKey: string, patch: SessionPatchFields) => Promise<boolean>;
  /** Apply an incoming sessions.changed event to update or insert a session. */
  applySessionChangedEvent: (payload: SessionsChangedPayload) => void;
  /** Compact a session's context via sessions.compact RPC. */
  compactSession: (key: string) => Promise<{ ok: boolean; reason?: string }>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  selectedKey: null,
  history: [],
  loading: false,
  error: null,

  fetchSessions: async (opts) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (opts?.search?.trim()) {
        params.set("search", opts.search.trim());
      }
      if (opts?.limit != null) {
        params.set("limit", String(opts.limit));
      }
      if (opts?.activeMinutes != null) {
        params.set("activeMinutes", String(opts.activeMinutes));
      }
      const qs = params.toString();
      const res = await fetch(`/api/sessions${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({
          error: (body as { error?: string }).error ?? `Failed to fetch sessions (${res.status})`,
          loading: false,
        });
        return;
      }
      const data = await res.json();
      const raw = Array.isArray(data)
        ? data
        : Array.isArray((data as { sessions?: unknown }).sessions)
          ? (data as { sessions: unknown[] }).sessions
          : [];
      const sessions = (raw as Record<string, unknown>[]).map(normalizeSession);
      set({ sessions, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch sessions",
        loading: false,
      });
    }
  },

  selectSession: (key) => {
    set({ selectedKey: key, history: [] });
    if (key) {
      void get().fetchHistory(key);
    }
  },

  fetchHistory: async (sessionKey) => {
    try {
      // Check transcript cache first (shared with Chat panel)
      const cached = getCachedTranscript(sessionKey);
      if (cached) {
        set({ history: cached });
        return;
      }

      const res = await fetch(`/api/chat/history?sessionKey=${encodeURIComponent(sessionKey)}`);
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const rawMessages = Array.isArray(data)
        ? data
        : Array.isArray((data as { messages?: unknown }).messages)
          ? (data as { messages: unknown[] }).messages
          : [];
      const messages = normalizeTranscriptMessages(
        sessionKey,
        rawMessages as Record<string, unknown>[],
      );
      setCachedTranscript(sessionKey, messages);
      set({ history: messages });
    } catch {
      // silently ignore — history is non-critical
    }
  },

  deleteSession: async (sessionKey) => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        return;
      }
      // Remove from local list, clear selection if active, and invalidate cache.
      invalidateTranscript(sessionKey);
      const state = get();
      set({
        sessions: state.sessions.filter((s) => s.key !== sessionKey),
        selectedKey: state.selectedKey === sessionKey ? null : state.selectedKey,
        history: state.selectedKey === sessionKey ? [] : state.history,
      });
    } catch {
      // silently ignore
    }
  },

  patchSession: async (sessionKey, patch) => {
    try {
      const res = await fetch("/api/chat/sessions/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, ...patch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Patch failed" }));
        console.error("[sessions] patch failed:", (data as { error?: string }).error);
        return false;
      }
      // Optimistic update: apply patched fields locally (convert null → undefined)
      const localPatch: Partial<SessionEntry> = {};
      for (const [k, v] of Object.entries(patch)) {
        (localPatch as Record<string, unknown>)[k] = v === null ? undefined : v;
      }
      set((state) => ({
        sessions: state.sessions.map((s) => (s.key === sessionKey ? { ...s, ...localPatch } : s)),
      }));
      return true;
    } catch (err) {
      console.error("[sessions] patch error:", err);
      return false;
    }
  },

  applySessionChangedEvent: (payload) => {
    const key = payload.sessionKey;
    if (!key) {
      return;
    }
    // Invalidate transcript cache on any session state change (SSE event-driven)
    invalidateTranscript(key);

    set((state) => {
      const sessions = [...state.sessions];
      const idx = sessions.findIndex((s) => s.key === key);

      // Build patch from typed payload fields
      const patch: Partial<SessionEntry> = {
        updatedAt: payload.ts ?? Date.now(),
        ...(typeof payload.status === "string" ? { status: payload.status } : {}),
        ...(typeof payload.model === "string" ? { model: payload.model } : {}),
        ...(typeof payload.totalTokens === "number" ? { totalTokens: payload.totalTokens } : {}),
        ...(typeof payload.estimatedCostUsd === "number"
          ? { estimatedCostUsd: payload.estimatedCostUsd }
          : {}),
        ...(typeof payload.contextTokens === "number"
          ? { contextWindow: payload.contextTokens }
          : {}),
        ...(typeof payload.inputTokens === "number" ? { tokensIn: payload.inputTokens } : {}),
        ...(typeof payload.outputTokens === "number" ? { tokensOut: payload.outputTokens } : {}),
        ...(typeof payload.compactionCount === "number"
          ? { compactionCount: payload.compactionCount }
          : {}),
        ...(typeof payload.parentSessionKey === "string"
          ? { parentSessionKey: payload.parentSessionKey }
          : {}),
        ...(Array.isArray(payload.childSessions) ? { childSessions: payload.childSessions } : {}),
        ...(typeof payload.subagentRole === "string"
          ? { subagentRole: payload.subagentRole as SessionEntry["subagentRole"] }
          : {}),
        ...(typeof payload.subagentControlScope === "string"
          ? {
              subagentControlScope:
                payload.subagentControlScope as SessionEntry["subagentControlScope"],
            }
          : {}),
        ...(typeof payload.spawnedWorkspaceDir === "string"
          ? { spawnedWorkspaceDir: payload.spawnedWorkspaceDir }
          : {}),
      };

      // After compaction, Gateway deletes inputTokens/outputTokens/totalTokens.
      // The event sends undefined for these fields (skipped by typeof guards above).
      // Explicitly reset them so the UI shows accurate post-compaction values.
      if (payload.compacted === true) {
        patch.tokensIn = patch.tokensIn ?? 0;
        patch.tokensOut = patch.tokensOut ?? 0;
        patch.totalTokens = patch.totalTokens ?? 0;
        // Only increment locally if the payload didn't already provide an authoritative count
        if (typeof patch.compactionCount !== "number" && idx >= 0) {
          patch.compactionCount = (sessions[idx].compactionCount ?? 0) + 1;
        }
      }

      if (idx >= 0) {
        sessions[idx] = { ...sessions[idx], ...patch };
      } else if (payload.reason === "create") {
        // New session — infer agentId and kind from key
        const agentMatch = key.match(/^[^:]*:([^:]+)/);
        const agentId = agentMatch?.[1] ?? "main";
        sessions.unshift({
          key,
          kind: inferKind(key),
          model: patch.model ?? "",
          tokensIn: 0,
          tokensOut: 0,
          contextWindow: patch.contextWindow ?? 0,
          updatedAt: patch.updatedAt ?? Date.now(),
          status: patch.status,
          totalTokens: patch.totalTokens,
          estimatedCostUsd: patch.estimatedCostUsd,
          parentSessionKey: patch.parentSessionKey,
          childSessions: patch.childSessions,
          subagentRole: patch.subagentRole,
          subagentControlScope: patch.subagentControlScope,
          spawnedWorkspaceDir: patch.spawnedWorkspaceDir,
        } as SessionEntry);
        void agentId; // agentId is encoded in session key, used for display only
      }

      return { sessions };
    });
  },

  compactSession: async (key) => {
    try {
      const res = await fetch("/api/chat/compact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: key }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string };
      if (!res.ok || !data.ok) {
        return { ok: false, reason: data.reason ?? "Compact failed" };
      }
      // Re-fetch sessions to pick up post-compaction token values
      void get().fetchSessions();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Compact failed" };
    }
  },
}));
