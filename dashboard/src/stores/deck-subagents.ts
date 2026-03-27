import { create } from "zustand";
import type {
  DeckSubagentsListResult,
  DeckSubagentsLineageResult,
} from "@/types/gateway-protocol.generated";

// ---------------------------------------------------------------------------
// Types — derived from generated protocol types + local extensions
// ---------------------------------------------------------------------------

/** Subagent run with UI alias fields (not in gateway response). */
export type SubagentRun = DeckSubagentsListResult["runs"][number] & {
  /** Alias for childSessionKey — used by UI components for keying. */
  sessionKey: string;
  /** Alias for childAgentId — used by UI components for filtering. */
  agentId: string;
  /** Alias for requesterSessionKey — used by tree-nesting in ActiveRunsTab. */
  parentSessionKey?: string;
};

export type LineageNode = DeckSubagentsLineageResult["nodes"][number];

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
  _visibilityHandler: (() => void) | null;

  fetchRuns: (status?: string, requesterAgentId?: string) => Promise<void>;
  fetchLineage: (params: { runId?: string; sessionKey?: string }) => Promise<void>;
  killRun: (runId: string) => Promise<boolean>;
  steerRun: (
    runId: string,
    instruction: string,
  ) => Promise<{ success: boolean; deduped?: boolean } | null>;
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
  _visibilityHandler: null,

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

  fetchLineage: async (params: { runId?: string; sessionKey?: string }) => {
    try {
      const res = await fetch("/api/deck/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lineage", ...params }),
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

  steerRun: async (runId: string, instruction: string) => {
    try {
      const res = await fetch("/api/deck/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "steer", runId, instruction }),
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as { success: boolean; deduped?: boolean };
      return data;
    } catch {
      return null;
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

    set({ polling: true, _pollTimer: timer, _visibilityHandler: handleVisibility });
  },

  stopPolling: () => {
    const timer = get()._pollTimer;
    if (timer) {
      clearInterval(timer);
    }
    // Always remove visibility listener to prevent leaks
    const handler = get()._visibilityHandler;
    if (handler) {
      document.removeEventListener("visibilitychange", handler);
    }
    set({ polling: false, _pollTimer: null, _visibilityHandler: null });
  },
}));
