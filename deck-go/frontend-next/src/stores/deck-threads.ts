import { create } from "zustand";
import { deckFetch } from "@/lib/deck-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadEntry {
  threadId: string;
  channelId: string;
  agentId: string;
  targetSessionKey: string;
  targetKind: string;
  boundAt: number;
  lastActivityAt: number;
  accountId: string;
  boundBy: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ThreadsState {
  threads: ThreadEntry[];
  loading: boolean;
  error: string | null;
  selectedThreadId: string | null;
  filterAgent: string;
  filterChannel: string;
  filterStatus: "active" | "all";

  fetchThreads: () => Promise<void>;
  selectThread: (threadId: string | null) => void;
  setFilterAgent: (agentId: string) => void;
  setFilterChannel: (channel: string) => void;
  setFilterStatus: (status: "active" | "all") => void;
}

let _filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useThreadsStore = create<ThreadsState>((set, get) => ({
  threads: [],
  loading: false,
  error: null,
  selectedThreadId: null,
  filterAgent: "",
  filterChannel: "",
  filterStatus: "active",

  fetchThreads: async () => {
    set({ loading: true, error: null });
    try {
      const { filterAgent, filterChannel, filterStatus } = get();
      const params = new URLSearchParams();
      if (filterAgent) {
        params.set("agentId", filterAgent);
      }
      if (filterChannel) {
        params.set("channel", filterChannel);
      }
      if (filterStatus) {
        params.set("status", filterStatus);
      }

      const res = await deckFetch(`/api/deck/threads?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch threads" }));
        set({ error: (data as { error?: string }).error ?? "Failed to fetch threads" });
        return;
      }
      const data = await res.json();
      const threads: ThreadEntry[] = Array.isArray(data.threads) ? data.threads : [];
      set((state) => {
        const selectedStillExists = threads.some(
          (thread) => thread.threadId === state.selectedThreadId,
        );
        return {
          threads,
          selectedThreadId: selectedStillExists
            ? state.selectedThreadId
            : (threads[0]?.threadId ?? null),
        };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch threads" });
    } finally {
      set({ loading: false });
    }
  },

  selectThread: (selectedThreadId) => set({ selectedThreadId }),

  setFilterAgent: (agentId) => {
    set({ filterAgent: agentId });
    if (_filterDebounceTimer) {
      clearTimeout(_filterDebounceTimer);
    }
    _filterDebounceTimer = setTimeout(() => {
      void get().fetchThreads();
    }, 300);
  },

  setFilterChannel: (channel) => {
    set({ filterChannel: channel });
    if (_filterDebounceTimer) {
      clearTimeout(_filterDebounceTimer);
    }
    _filterDebounceTimer = setTimeout(() => {
      void get().fetchThreads();
    }, 300);
  },

  setFilterStatus: (status) => {
    set({ filterStatus: status });
    void get().fetchThreads();
  },
}));
