import { useEffect, useMemo, useState } from "react";
import type { DeckGoCronJob, DeckGoCronRunsResponse, DeckGoCronStatus } from "../../api";
import {
  deleteCronJob,
  fetchCronJobs,
  fetchCronRuns,
  fetchCronStatus,
  runCronJob,
} from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

function summarizeSchedule(job: DeckGoCronJob) {
  if (job.schedule.kind === "cron") {
    return job.schedule.expr || "cron";
  }
  if (job.schedule.kind === "every") {
    return job.schedule.everyMs ? `every ${job.schedule.everyMs}ms` : "every";
  }
  return job.schedule.at || "at";
}

export function RestoredCronPanel() {
  const [jobs, setJobs] = useState<DeckGoCronJob[]>([]);
  const [status, setStatus] = useState<DeckGoCronStatus | null>(null);
  const [runsResponse, setRunsResponse] = useState<DeckGoCronRunsResponse | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "running" | "deleting">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredJobId?: string) => {
    setLoadState("loading");
    try {
      const [jobsResponse, nextStatus] = await Promise.all([fetchCronJobs(), fetchCronStatus()]);
      const nextJobs = jobsResponse.jobs ?? [];
      setJobs(nextJobs);
      setStatus(nextStatus);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredJobId?.trim() || nextJobs[0]?.id || "";
      const nextSelected = nextJobs.some((job) => job.id === selectedJobId)
        ? selectedJobId
        : nextJobs.some((job) => job.id === fallbackId)
          ? fallbackId
          : nextJobs[0]?.id || "";
      setSelectedJobId(nextSelected);
      if (nextSelected) {
        const nextRuns = await fetchCronRuns(nextSelected);
        setRunsResponse(nextRuns);
      } else {
        setRunsResponse(null);
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load cron");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setRunsResponse(null);
      return;
    }
    void fetchCronRuns(selectedJobId)
      .then((next) => {
        setRunsResponse(next);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "failed to load cron runs");
      });
  }, [selectedJobId]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const runs = runsResponse?.entries ?? [];
  const enabledCount = useMemo(() => jobs.filter((job) => job.enabled).length, [jobs]);

  const runAction = async () => {
    if (!selectedJob) {
      return;
    }
    setActionState("running");
    try {
      const result = await runCronJob(selectedJob.id);
      setActionResult(result);
      setError("");
      await refresh(selectedJob.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "cron run failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedJob) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteCronJob(selectedJob.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "cron delete failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Cron jobs</h2>
          </div>
          <p className="deckgo-card-subtitle">
            First Vite-owned scheduler slice: inventory, status, run history, and bounded run/delete
            actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Cron {loadState}
              </span>
              <span className="deckgo-pill">running: {status?.running ? "yes" : "no"}</span>
              <span className="deckgo-pill">jobs: {status?.jobCount ?? jobs.length}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="jobs" value={jobs.length} />
              <ShellStat label="enabled" value={enabledCount} />
              <ShellStat
                label="next run"
                value={status?.nextRunAtMs ? new Date(status.nextRunAtMs).toLocaleString() : "n/a"}
              />
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refresh(selectedJobId)}
              >
                Refresh cron
              </button>
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void runAction()}
                disabled={!selectedJob || actionState !== "idle"}
              >
                {actionState === "running" ? "Running" : "Run now"}
              </button>
              <button
                className="deckgo-button is-danger"
                type="button"
                onClick={() => void deleteAction()}
                disabled={!selectedJob || actionState !== "idle"}
              >
                {actionState === "deleting" ? "Deleting" : "Delete"}
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {jobs.length === 0 ? (
              <p className="deckgo-note">No cron jobs loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedJob?.id === job.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <strong>{job.name}</strong>
                      <div className="deckgo-meta">
                        schedule: {summarizeSchedule(job)} | enabled: {job.enabled ? "yes" : "no"}
                      </div>
                      <div className="deckgo-meta">
                        next: {job.nextRunAtMs ? new Date(job.nextRunAtMs).toLocaleString() : "n/a"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected job</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice is still bounded, but it moves cron off the placeholder path and into a real
            Vite-owned operator surface.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedJob ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Job</p>
                    <strong>{selectedJob.name}</strong>
                    <p className="deckgo-note">{selectedJob.description || "No description"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {selectedJob.enabled ? "enabled" : "disabled"}
                    </span>
                    <span className="deckgo-pill">{summarizeSchedule(selectedJob)}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="agent" value={selectedJob.agentId || "n/a"} />
                  <ShellStat
                    label="next run"
                    value={
                      selectedJob.nextRunAtMs
                        ? new Date(selectedJob.nextRunAtMs).toLocaleString()
                        : "n/a"
                    }
                  />
                </div>
                <JsonDetails title="Job payload" payload={selectedJob} />
                <JsonDetails title="Run history" payload={runs} />
              </>
            ) : (
              <p className="deckgo-note">Choose a cron job to inspect it.</p>
            )}
            {actionResult ? <JsonDetails title="Last cron action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
