import { create } from "zustand";

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
  startedAt: string;
  durationMs?: number;
  delivery?: unknown;
  error?: string;
}

export interface CronStatus {
  running: boolean;
  jobCount?: number;
  nextRunAtMs?: number;
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

  selectJob: (jobId) => set({ selectedJobId: jobId }),

  fetchJobs: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/cron");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to fetch jobs", loading: false });
        return;
      }
      const data = (await res.json()) as { jobs?: CronJob[] };
      set({ jobs: data.jobs ?? [], loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch jobs", loading: false });
    }
  },

  addJob: async (job) => {
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      if (!res.ok) {
        return null;
      }
      const created = (await res.json()) as CronJob;
      set((s) => ({ jobs: [...s.jobs, created] }));
      return created;
    } catch {
      return null;
    }
  },

  updateJob: async (jobId, patch) => {
    try {
      const res = await fetch(`/api/cron/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        return false;
      }
      const updated = (await res.json()) as CronJob;
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
      return true;
    } catch {
      return false;
    }
  },

  removeJob: async (jobId) => {
    try {
      const res = await fetch(`/api/cron/${jobId}`, { method: "DELETE" });
      if (!res.ok) {
        return false;
      }
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
      const res = await fetch(`/api/cron/${jobId}/run`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  },

  fetchRuns: async (jobId) => {
    try {
      const res = await fetch(`/api/cron/${jobId}/runs`);
      if (!res.ok) {
        set({ runs: [] });
        return;
      }
      const data = (await res.json()) as { runs?: CronRunEntry[] };
      set({ runs: data.runs ?? [] });
    } catch {
      set({ runs: [] });
    }
  },

  fetchStatus: async () => {
    try {
      const res = await fetch("/api/cron/status");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as CronStatus;
      set({ status: data });
    } catch {
      // best-effort
    }
  },
}));
