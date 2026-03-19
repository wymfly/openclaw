import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubagentRun {
  runId: string;
  childSessionKey: string;
  childAgentId: string;
  childAgentName?: string;
  requesterSessionKey?: string;
  requesterAgentId?: string;
  requesterAgentName?: string;
  task?: string;
  label?: string;
  model?: string;
  spawnMode?: string;
  status: "active" | "completed" | "failed" | "timeout";
  depth: number;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  outcome?: { status?: string; error?: string };
}

export interface LineageNode {
  runId: string;
  sessionKey: string;
  agentId: string;
  agentName?: string;
  task?: string;
  depth: number;
  parentRunId: string | null;
  status: "active" | "completed" | "failed" | "timeout";
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Store — visibility-gated polling
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;

interface DeckSubagentsState {
  activeRuns: SubagentRun[];
  historyRuns: SubagentRun[];
  lineage: LineageNode[];
  loading: boolean;
  error: string | null;

  // Polling
  polling: boolean;
  _pollTimer: ReturnType<typeof setInterval> | null;

  fetchRuns: (status?: string, requesterAgentId?: string) => Promise<void>;
  fetchLineage: (runId: string) => Promise<void>;
  killRun: (runId: string) => Promise<boolean>;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useDeckSubagentsStore = create<DeckSubagentsState>((set, get) => ({
  activeRuns: [],
  historyRuns: [],
  lineage: [],
  loading: false,
  error: null,
  polling: false,
  _pollTimer: null,

  fetchRuns: async (status?: string, requesterAgentId?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }
      if (requesterAgentId) {
        params.set("requesterAgentId", requesterAgentId);
      }
      const res = await fetch(`/api/deck/subagents?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch subagent runs" }));
        set({ error: (data as { error?: string }).error ?? "Failed to fetch subagent runs" });
        return;
      }
      const data = await res.json();
      const runs: SubagentRun[] = Array.isArray(data.runs) ? data.runs : [];
      set({
        activeRuns: runs.filter((r) => r.status === "active"),
        historyRuns: runs.filter((r) => r.status !== "active"),
      });
    } catch {
      set({ error: "Failed to fetch subagent runs" });
    } finally {
      set({ loading: false });
    }
  },

  fetchLineage: async (runId: string) => {
    try {
      const res = await fetch("/api/deck/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lineage", runId }),
      });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      set({ lineage: Array.isArray(data.nodes) ? data.nodes : [] });
    } catch {
      // ignore
    }
  },

  killRun: async (runId: string) => {
    try {
      const res = await fetch("/api/deck/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kill", runId }),
      });
      if (res.ok) {
        await get().fetchRuns();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  startPolling: () => {
    const state = get();
    if (state._pollTimer) {
      return;
    }

    const poll = () => void get().fetchRuns();
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    set({ polling: true, _pollTimer: timer });

    // Visibility-gated: pause when tab hidden, resume when visible
    const handleVisibility = () => {
      if (document.hidden) {
        const t = get()._pollTimer;
        if (t) {
          clearInterval(t);
          set({ _pollTimer: null });
        }
      } else {
        const existing = get()._pollTimer;
        if (!existing && get().polling) {
          poll();
          const newTimer = setInterval(poll, POLL_INTERVAL_MS);
          set({ _pollTimer: newTimer });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Store cleanup reference on the timer for stopPolling
    (timer as unknown as Record<string, unknown>).__cleanup = () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  },

  stopPolling: () => {
    const timer = get()._pollTimer;
    if (timer) {
      clearInterval(timer);
      const cleanup = (timer as unknown as Record<string, () => void>).__cleanup;
      if (typeof cleanup === "function") {
        cleanup();
      }
    }
    set({ polling: false, _pollTimer: null });
  },
}));
