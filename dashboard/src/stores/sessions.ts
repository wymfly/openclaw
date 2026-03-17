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
}

export interface HistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    tokensIn: Number(raw.tokensIn ?? 0),
    tokensOut: Number(raw.tokensOut ?? 0),
    contextWindow: Number(raw.contextWindow ?? 0),
    updatedAt: Number(raw.updatedAt ?? raw.lastActivityAt ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SessionsState {
  sessions: SessionEntry[];
  selectedKey: string | null;
  history: HistoryMessage[];
  loading: boolean;
  error: string | null;

  fetchSessions: () => Promise<void>;
  selectSession: (key: string | null) => void;
  fetchHistory: (sessionKey: string) => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  selectedKey: null,
  history: [],
  loading: false,
  error: null,

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/sessions");
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
      const messages = Array.isArray(data)
        ? data
        : Array.isArray((data as { messages?: unknown }).messages)
          ? (data as { messages: unknown[] }).messages
          : [];
      set({ history: messages as HistoryMessage[] });
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
}));
