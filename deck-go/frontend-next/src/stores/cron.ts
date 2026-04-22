import { create } from "zustand";
import { DeckApiError, fetchApi } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CronSchedule {
  kind: "at" | "every" | "cron";
  /** ISO date for kind=at */
  at?: string;
  /** Interval in ms for kind=every */
  everyMs?: number;
  anchorMs?: number;
  /** Cron expression for kind=cron */
  expr?: string;
  tz?: string;
  staggerMs?: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: CronSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  delivery?: unknown;
  failureAlert?: boolean;
  agentId?: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  nextRunAtMs?: number;
  updatedAtMs?: number;
  createdAtMs?: number;
}

export interface CronRunEntry {
  id: string;
  jobId: string;
  status: "ok" | "error" | "skipped";
  /** Unix ms timestamp from Gateway (replaces the old `startedAt` ISO string). */
  ts: number;
  runAtMs?: number;
  durationMs?: number;
  delivery?: unknown;
  error?: string;
}

export interface CronStatus {
  running: boolean;
  jobCount?: number;
  nextRunAtMs?: number;
}

export interface HeartbeatConfig {
  enabled: boolean;
  every?: string;
  activeHours?: { start?: string; end?: string; timezone?: string };
  target?: string;
  prompt?: string;
  model?: string;
}

export interface HeartbeatOverride {
  agentId: string;
  agentName?: string;
  every: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CronState {
  jobs: CronJob[];
  selectedJobId: string | null;
  runs: CronRunEntry[];
  status: CronStatus | null;
  loading: boolean;
  error: string | null;

  // Heartbeat (P5 — stub state, API pending)
  heartbeatConfig: HeartbeatConfig | null;
  heartbeatOverrides: HeartbeatOverride[];
  heartbeatLoading: boolean;
  fetchHeartbeatConfig: () => Promise<void>;
  updateHeartbeatConfig: (patch: Partial<HeartbeatConfig>) => Promise<void>;
  addHeartbeatOverride: (agentId: string, every: string) => Promise<void>;
  removeHeartbeatOverride: (agentId: string) => Promise<void>;

  fetchJobs: () => Promise<void>;
  addJob: (job: Omit<CronJob, "id">) => Promise<CronJob | null>;
  updateJob: (jobId: string, patch: Partial<CronJob>) => Promise<boolean>;
  removeJob: (jobId: string) => Promise<boolean>;
  runJob: (jobId: string) => Promise<boolean>;
  fetchRuns: (jobId: string) => Promise<void>;
  fetchStatus: () => Promise<void>;
  selectJob: (jobId: string | null) => void;
}

export const useCronStore = create<CronState>((set) => ({
  jobs: [],
  selectedJobId: null,
  runs: [],
  status: null,
  loading: false,
  error: null,

  // Heartbeat stubs — backend API not yet implemented
  heartbeatConfig: null,
  heartbeatOverrides: [],
  heartbeatLoading: false,
  fetchHeartbeatConfig: async () => {
    set({ heartbeatLoading: true });
    // TODO: call /api/cron/heartbeat when backend RPC is available
    set({ heartbeatConfig: { enabled: false }, heartbeatLoading: false });
  },
  updateHeartbeatConfig: async (_patch) => {
    // TODO: call backend
  },
  addHeartbeatOverride: async (_agentId, _every) => {
    // TODO: call backend
  },
  removeHeartbeatOverride: async (_agentId) => {
    // TODO: call backend
  },

  selectJob: (jobId) => set({ selectedJobId: jobId }),

  fetchJobs: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchApi<{ jobs?: CronJob[] }>("/api/cron");
      set({ jobs: data.jobs ?? [], loading: false });
    } catch (err) {
      set({
        error: err instanceof DeckApiError ? err.body.error : "Failed to fetch jobs",
        loading: false,
      });
    }
  },

  addJob: async (job) => {
    try {
      const created = await fetchApi<CronJob>("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      set((s) => ({ jobs: [...s.jobs, created] }));
      return created;
    } catch {
      return null;
    }
  },

  updateJob: async (jobId, patch) => {
    try {
      const updated = await fetchApi<CronJob>(`/api/cron/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
      return true;
    } catch {
      return false;
    }
  },

  removeJob: async (jobId) => {
    try {
      await fetchApi<unknown>(`/api/cron/${jobId}`, { method: "DELETE" });
      set((s) => ({
        jobs: s.jobs.filter((j) => j.id !== jobId),
        selectedJobId: s.selectedJobId === jobId ? null : s.selectedJobId,
      }));
      return true;
    } catch {
      return false;
    }
  },

  runJob: async (jobId) => {
    try {
      await fetchApi<unknown>(`/api/cron/${jobId}/run`, { method: "POST" });
      return true;
    } catch {
      return false;
    }
  },

  fetchRuns: async (jobId) => {
    try {
      const data = await fetchApi<{ entries?: CronRunEntry[] }>(`/api/cron/${jobId}/runs`);
      set({ runs: data.entries ?? [] });
    } catch {
      set({ runs: [] });
    }
  },

  fetchStatus: async () => {
    try {
      const data = await fetchApi<CronStatus>("/api/cron/status");
      set({ status: data });
    } catch {
      // best-effort
    }
  },
}));
