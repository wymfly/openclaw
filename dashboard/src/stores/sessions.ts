import { create } from "zustand";

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

export interface HistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize message content that may be a string or an array of content blocks.
 * Gateway chat.history may return `content` as `[{ type: "text", text: "..." }, ...]`.
 */
function normalizeContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: string; text: string } => {
        return (
          b != null &&
          typeof b === "object" &&
          "type" in b &&
          (b as { type: string }).type === "text" &&
          "text" in b
        );
      })
      .map((b) => b.text)
      .join("\n");
  }
  return "";
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
  patchSession: (sessionKey: string, patch: Record<string, unknown>) => Promise<boolean>;
  /** Apply an incoming sessions.changed event to update or insert a session. */
  applySessionChangedEvent: (payload: Record<string, unknown>) => void;
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
        const body = await res.json();
        set({
          error: (body as { error?: string }).error ?? "Failed to fetch sessions",
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
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}`);
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const rawMessages = Array.isArray(data)
        ? data
        : Array.isArray((data as { messages?: unknown }).messages)
          ? (data as { messages: unknown[] }).messages
          : [];
      const messages: HistoryMessage[] = (rawMessages as Record<string, unknown>[]).map((m) => ({
        role: (m.role as HistoryMessage["role"]) ?? "user",
        content: normalizeContent(m.content),
        timestamp: typeof m.timestamp === "number" ? m.timestamp : undefined,
      }));
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
      // Remove from local list and clear selection if active.
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
      // Optimistic update: apply patched fields locally
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.key === sessionKey ? { ...s, ...patch } : s,
        ),
      }));
      return true;
    } catch (err) {
      console.error("[sessions] patch error:", err);
      return false;
    }
  },

  applySessionChangedEvent: (payload: Record<string, unknown>) => {
    const key = payload.sessionKey as string;
    if (!key) return;

    set((state) => {
      const sessions = [...state.sessions];
      const idx = sessions.findIndex((s) => s.key === key);

      // Build patch from typed payload fields
      const patch: Partial<SessionEntry> = {
        updatedAt: (payload.ts as number) ?? Date.now(),
        ...(typeof payload.status === "string" ? { status: payload.status } : {}),
        ...(typeof payload.model === "string" ? { model: payload.model } : {}),
        ...(typeof payload.totalTokens === "number" ? { totalTokens: payload.totalTokens } : {}),
        ...(typeof payload.estimatedCostUsd === "number"
          ? { estimatedCostUsd: payload.estimatedCostUsd }
          : {}),
        ...(typeof payload.contextTokens === "number"
          ? { contextWindow: payload.contextTokens }
          : {}),
        ...(typeof payload.parentSessionKey === "string"
          ? { parentSessionKey: payload.parentSessionKey }
          : {}),
        ...(Array.isArray(payload.childSessions)
          ? { childSessions: payload.childSessions as string[] }
          : {}),
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
}));
