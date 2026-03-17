import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogSource = "gateway" | "agent" | "channel" | "unknown";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  sessionKey?: string;
}

export interface LogFilters {
  levels: LogLevel[];
  source: LogSource | "all";
  sessionKey: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface LogsState {
  entries: LogEntry[];
  filters: LogFilters;
  streaming: boolean;
  maxEntries: number;

  addEntries: (newEntries: LogEntry[]) => void;
  setLevelFilter: (levels: LogLevel[]) => void;
  setSourceFilter: (source: LogSource | "all") => void;
  setSessionFilter: (sessionKey: string) => void;
  clearLogs: () => void;
  setStreaming: (streaming: boolean) => void;
}

export const useLogsStore = create<LogsState>((set) => ({
  entries: [],
  filters: {
    levels: ["debug", "info", "warn", "error"],
    source: "all",
    sessionKey: "",
  },
  streaming: true,
  maxEntries: 500,

  addEntries: (newEntries) =>
    set((state) => {
      const combined = [...state.entries, ...newEntries];
      // Cap at maxEntries, keeping newest.
      const trimmed =
        combined.length > state.maxEntries
          ? combined.slice(combined.length - state.maxEntries)
          : combined;
      return { entries: trimmed };
    }),

  setLevelFilter: (levels) => set((state) => ({ filters: { ...state.filters, levels } })),

  setSourceFilter: (source) => set((state) => ({ filters: { ...state.filters, source } })),

  setSessionFilter: (sessionKey) => set((state) => ({ filters: { ...state.filters, sessionKey } })),

  clearLogs: () => set({ entries: [] }),

  setStreaming: (streaming) => set({ streaming }),
}));
