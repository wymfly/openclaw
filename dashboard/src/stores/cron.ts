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
  /** UI-derived field (true when `every` is set), not a schema field. */
  enabled: boolean;
  /** Interval string, e.g. "30m", "1h". */
  every?: string;
  activeHours?: { start?: string; end?: string; timezone?: string };
  /** Target agent ID. */
  target?: string;
  /** Message template. */
  prompt?: string;
  model?: string;
  session?: string;
}

export interface HeartbeatOverride {
  agentId: string;
  agentName?: string;
  every?: string;
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

  // Heartbeat state
  heartbeatConfig: HeartbeatConfig | null;
  heartbeatOverrides: HeartbeatOverride[];
  heartbeatLoading: boolean;
  /** baseHash from last config.get — required for config.patch calls. */
  heartbeatBaseHash: string | null;

  fetchJobs: () => Promise<void>;
  addJob: (job: Omit<CronJob, "id">) => Promise<CronJob | null>;
  updateJob: (jobId: string, patch: Partial<CronJob>) => Promise<boolean>;
  removeJob: (jobId: string) => Promise<boolean>;
  runJob: (jobId: string) => Promise<boolean>;
  fetchRuns: (jobId: string) => Promise<void>;
  fetchStatus: () => Promise<void>;
  selectJob: (jobId: string | null) => void;

  // Heartbeat actions
  fetchHeartbeatConfig: () => Promise<void>;
  updateHeartbeatConfig: (patch: Partial<HeartbeatConfig>) => Promise<boolean>;
  addHeartbeatOverride: (agentId: string, every: string) => Promise<boolean>;
  removeHeartbeatOverride: (agentId: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ConfigPayload {
  agents?: {
    defaults?: { heartbeat?: Record<string, unknown> | null };
    list?: Array<Record<string, unknown>>;
  };
  [key: string]: unknown;
}

function extractHeartbeatConfig(cfg: ConfigPayload): HeartbeatConfig {
  const hb = cfg?.agents?.defaults?.heartbeat;
  if (!hb) {
    return { enabled: false };
  }
  const every = typeof hb.every === "string" ? hb.every : undefined;
  const activeHours = hb.activeHours as HeartbeatConfig["activeHours"] | undefined;
  return {
    enabled: !!every,
    every,
    activeHours,
    target: typeof hb.target === "string" ? hb.target : undefined,
    prompt: typeof hb.prompt === "string" ? hb.prompt : undefined,
    model: typeof hb.model === "string" ? hb.model : undefined,
    session: typeof hb.session === "string" ? hb.session : undefined,
  };
}

function extractHeartbeatOverrides(cfg: ConfigPayload): HeartbeatOverride[] {
  const agents = cfg?.agents?.list;
  if (!Array.isArray(agents)) {
    return [];
  }
  const overrides: HeartbeatOverride[] = [];
  for (const agent of agents) {
    const hb = agent.heartbeat as Record<string, unknown> | undefined;
    if (hb && typeof hb.every === "string") {
      overrides.push({
        agentId: typeof agent.id === "string" ? agent.id : JSON.stringify(agent.id ?? ""),
        agentName: typeof agent.name === "string" ? agent.name : undefined,
        every: hb.every,
      });
    }
  }
  return overrides;
}

export const useCronStore = create<CronState>((set, get) => ({
  jobs: [],
  selectedJobId: null,
  runs: [],
  status: null,
  loading: false,
  error: null,
  heartbeatConfig: null,
  heartbeatOverrides: [],
  heartbeatLoading: false,
  heartbeatBaseHash: null,

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
      const data = (await res.json()) as { entries?: CronRunEntry[] };
      set({ runs: data.entries ?? [] });
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

  // -------------------------------------------------------------------------
  // Heartbeat actions
  // -------------------------------------------------------------------------

  fetchHeartbeatConfig: async () => {
    set({ heartbeatLoading: true });
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        set({ heartbeatLoading: false });
        return;
      }
      const cfg = (await res.json()) as ConfigPayload & { baseHash?: string };
      set({
        heartbeatConfig: extractHeartbeatConfig(cfg),
        heartbeatOverrides: extractHeartbeatOverrides(cfg),
        heartbeatBaseHash: typeof cfg.baseHash === "string" ? cfg.baseHash : null,
        heartbeatLoading: false,
      });
    } catch {
      set({ heartbeatLoading: false });
    }
  },

  updateHeartbeatConfig: async (patch) => {
    // Strip the UI-only `enabled` field before sending to the API.
    const { enabled: _enabled, ...rest } = patch;
    // When disabling, set heartbeat to null so Gateway removes it entirely
    // (just clearing `every` would cause Gateway to fallback to the default 30m).
    const heartbeatPatch = patch.enabled === false ? null : rest;
    try {
      const res = await fetch("/api/config/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch: { agents: { defaults: { heartbeat: heartbeatPatch } } },
          baseHash: get().heartbeatBaseHash,
        }),
      });
      if (!res.ok) {
        return false;
      }
      // Refresh local state from the server.
      await get().fetchHeartbeatConfig();
      return true;
    } catch {
      return false;
    }
  },

  addHeartbeatOverride: async (agentId, every) => {
    try {
      // Read full config, find or create agent entry, set heartbeat.every, patch back.
      const cfgRes = await fetch("/api/config");
      if (!cfgRes.ok) {
        return false;
      }
      const cfg = (await cfgRes.json()) as ConfigPayload & { baseHash?: string };
      const baseHash = typeof cfg.baseHash === "string" ? cfg.baseHash : null;
      const agents = Array.isArray(cfg?.agents?.list) ? [...cfg.agents.list] : [];
      const idx = agents.findIndex((a) => a.id === agentId);
      if (idx >= 0) {
        const existing = { ...agents[idx] };
        existing.heartbeat = {
          ...(existing.heartbeat as Record<string, unknown> | undefined),
          every,
        };
        agents[idx] = existing;
      } else {
        agents.push({ id: agentId, heartbeat: { every } });
      }
      const res = await fetch("/api/config/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: { agents: { list: agents } }, baseHash }),
      });
      if (!res.ok) {
        return false;
      }
      await get().fetchHeartbeatConfig();
      return true;
    } catch {
      return false;
    }
  },

  removeHeartbeatOverride: async (agentId) => {
    try {
      const cfgRes = await fetch("/api/config");
      if (!cfgRes.ok) {
        return false;
      }
      const cfg = (await cfgRes.json()) as ConfigPayload & { baseHash?: string };
      const baseHash = typeof cfg.baseHash === "string" ? cfg.baseHash : null;
      const agents = Array.isArray(cfg?.agents?.list) ? [...cfg.agents.list] : [];
      const idx = agents.findIndex((a) => a.id === agentId);
      if (idx < 0) {
        return true; // nothing to remove
      }
      // Set the entire heartbeat to null so Gateway fully removes it.
      // Just deleting `every` would leave other heartbeat fields active.
      const existing = { ...agents[idx] };
      existing.heartbeat = null;
      agents[idx] = existing;
      const res = await fetch("/api/config/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: { agents: { list: agents } }, baseHash }),
      });
      if (!res.ok) {
        return false;
      }
      await get().fetchHeartbeatConfig();
      return true;
    } catch {
      return false;
    }
  },
}));
