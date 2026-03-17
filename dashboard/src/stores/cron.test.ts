import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCronStore, type CronJob, type CronRunEntry } from "./cron";

// Reset store between tests
beforeEach(() => {
  useCronStore.setState({
    jobs: [],
    selectedJobId: null,
    runs: [],
    status: null,
    loading: false,
    error: null,
  });
  vi.restoreAllMocks();
});

const JOB_FIXTURE: CronJob = {
  id: "job-1",
  name: "Test Job",
  schedule: { kind: "cron", expr: "*/5 * * * *" },
  sessionTarget: "main",
  wakeMode: "now",
  payload: { kind: "systemEvent", text: "ping" },
  enabled: true,
};

const RUN_FIXTURE: CronRunEntry = {
  id: "run-1",
  jobId: "job-1",
  status: "ok",
  ts: 1742169600000, // 2026-03-17T00:00:00Z as Unix ms
  durationMs: 150,
};

describe("cron store", () => {
  it("has correct initial state", () => {
    const state = useCronStore.getState();
    expect(state.jobs).toEqual([]);
    expect(state.selectedJobId).toBeNull();
    expect(state.runs).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("selectJob sets selectedJobId", () => {
    useCronStore.getState().selectJob("job-1");
    expect(useCronStore.getState().selectedJobId).toBe("job-1");
  });

  it("selectJob(null) clears selection", () => {
    useCronStore.getState().selectJob("job-1");
    useCronStore.getState().selectJob(null);
    expect(useCronStore.getState().selectedJobId).toBeNull();
  });

  describe("fetchJobs", () => {
    it("sets jobs on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ jobs: [JOB_FIXTURE] }), { status: 200 }),
      );

      await useCronStore.getState().fetchJobs();

      expect(useCronStore.getState().jobs).toHaveLength(1);
      expect(useCronStore.getState().jobs[0].id).toBe("job-1");
      expect(useCronStore.getState().loading).toBe(false);
    });

    it("sets error on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Gateway down" }), { status: 502 }),
      );

      await useCronStore.getState().fetchJobs();

      expect(useCronStore.getState().error).toBe("Gateway down");
      expect(useCronStore.getState().loading).toBe(false);
    });

    it("sets error on fetch exception", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

      await useCronStore.getState().fetchJobs();

      expect(useCronStore.getState().error).toBe("Network error");
      expect(useCronStore.getState().loading).toBe(false);
    });
  });

  describe("addJob", () => {
    it("adds job to state on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(JOB_FIXTURE), { status: 201 }),
      );

      const result = await useCronStore.getState().addJob({
        name: "Test Job",
        schedule: { kind: "cron", expr: "*/5 * * * *" },
        payload: { kind: "systemEvent", text: "ping" },
        enabled: true,
      });

      expect(result).toBeTruthy();
      expect(useCronStore.getState().jobs).toHaveLength(1);
    });

    it("returns null on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }),
      );

      const result = await useCronStore.getState().addJob({
        name: "Bad Job",
        schedule: { kind: "cron", expr: "bad" },
        payload: { kind: "systemEvent", event: "x" },
        enabled: true,
      });

      expect(result).toBeNull();
    });
  });

  describe("updateJob", () => {
    it("replaces job in state on success", async () => {
      const updated = { ...JOB_FIXTURE, name: "Updated" };
      useCronStore.setState({ jobs: [JOB_FIXTURE] });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(updated), { status: 200 }),
      );

      const ok = await useCronStore.getState().updateJob("job-1", { name: "Updated" });

      expect(ok).toBe(true);
      expect(useCronStore.getState().jobs[0].name).toBe("Updated");
    });

    it("returns false on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
      );

      const ok = await useCronStore.getState().updateJob("nope", { name: "x" });
      expect(ok).toBe(false);
    });
  });

  describe("removeJob", () => {
    it("removes job from state on success", async () => {
      useCronStore.setState({ jobs: [JOB_FIXTURE], selectedJobId: "job-1" });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ removed: true }), { status: 200 }),
      );

      const ok = await useCronStore.getState().removeJob("job-1");

      expect(ok).toBe(true);
      expect(useCronStore.getState().jobs).toHaveLength(0);
      expect(useCronStore.getState().selectedJobId).toBeNull();
    });

    it("returns false on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));

      const ok = await useCronStore.getState().removeJob("job-1");
      expect(ok).toBe(false);
    });
  });

  describe("runJob", () => {
    it("returns true on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const ok = await useCronStore.getState().runJob("job-1");
      expect(ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/cron/job-1/run", { method: "POST" });
    });
  });

  describe("fetchRuns", () => {
    it("sets runs on success (Gateway returns entries field)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ entries: [RUN_FIXTURE] }), { status: 200 }),
      );

      await useCronStore.getState().fetchRuns("job-1");

      expect(useCronStore.getState().runs).toHaveLength(1);
      expect(useCronStore.getState().runs[0].status).toBe("ok");
    });

    it("sets empty runs on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 500 }),
      );

      await useCronStore.getState().fetchRuns("job-1");
      expect(useCronStore.getState().runs).toEqual([]);
    });
  });

  describe("fetchStatus", () => {
    it("sets status on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ running: true, jobCount: 5 }), { status: 200 }),
      );

      await useCronStore.getState().fetchStatus();

      expect(useCronStore.getState().status).toEqual({ running: true, jobCount: 5 });
    });
  });
});
