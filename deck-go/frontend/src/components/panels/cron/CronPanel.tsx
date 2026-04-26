import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoCronJob,
  DeckGoCronJobInput,
  DeckGoCronRunsResponse,
  DeckGoCronSchedule,
  DeckGoCronStatus,
} from "../../../api";
import {
  createCronJob,
  deleteCronJob,
  fetchCronJobs,
  fetchCronRuns,
  fetchCronStatus,
  runCronJob,
  updateCronJob,
} from "../../../api";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type CronScheduleKind = DeckGoCronSchedule["kind"];
type CronPayloadKind = "systemEvent" | "agentTurn";
type CronTemplateKey = "every5min" | "hourly" | "daily" | "weekly";

type CronDraft = {
  name: string;
  scheduleKind: CronScheduleKind;
  scheduleValue: string;
  sessionTarget: string;
  wakeMode: string;
  payloadKind: CronPayloadKind;
  payloadValue: string;
  agentId: string;
  description: string;
  enabled: boolean;
};

const DEFAULT_DRAFT: CronDraft = {
  name: "",
  scheduleKind: "cron",
  scheduleValue: "0 9 * * *",
  sessionTarget: "main",
  wakeMode: "now",
  payloadKind: "systemEvent",
  payloadValue: "",
  agentId: "",
  description: "",
  enabled: true,
};

const CRON_TEMPLATES: Array<{ key: CronTemplateKey; label: string; expr: string }> = [
  { key: "every5min", label: "Every 5 min", expr: "*/5 * * * *" },
  { key: "hourly", label: "Hourly", expr: "0 * * * *" },
  { key: "daily", label: "Daily", expr: "0 9 * * *" },
  { key: "weekly", label: "Weekly", expr: "0 9 * * 1" },
];

const CRON_JOBS_QUERY = { includeDisabled: true } as const;
const CRON_RUNS_QUERY = { limit: 20, sortDir: "desc" } as const;

function summarizeSchedule(job: DeckGoCronJob) {
  if (job.schedule.kind === "cron") {
    return job.schedule.expr || "cron";
  }
  if (job.schedule.kind === "every") {
    return job.schedule.everyMs ? `every ${job.schedule.everyMs}ms` : "every";
  }
  return job.schedule.at || "at";
}

function scheduleValueFromJob(job: DeckGoCronJob) {
  if (job.schedule.kind === "every") {
    return String(job.schedule.everyMs ?? "");
  }
  if (job.schedule.kind === "at") {
    return job.schedule.at ?? "";
  }
  return job.schedule.expr ?? "";
}

function scheduleFromDraft(draft: CronDraft): DeckGoCronSchedule {
  if (draft.scheduleKind === "every") {
    return { kind: "every", everyMs: Math.trunc(Number(draft.scheduleValue)) };
  }
  if (draft.scheduleKind === "at") {
    return { kind: "at", at: draft.scheduleValue };
  }
  return { kind: "cron", expr: draft.scheduleValue };
}

function payloadKindFromJob(job: DeckGoCronJob): CronPayloadKind {
  return job.payload.kind === "agentTurn" ? "agentTurn" : "systemEvent";
}

function formatPayloadValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function payloadValueFromJob(job: DeckGoCronJob) {
  if (job.payload.kind === "agentTurn") {
    return formatPayloadValue(job.payload.message ?? job.payload.prompt);
  }
  return formatPayloadValue(job.payload.text);
}

function draftFromJob(job: DeckGoCronJob): CronDraft {
  const payloadKind = payloadKindFromJob(job);
  return {
    name: job.name,
    scheduleKind: job.schedule.kind,
    scheduleValue: scheduleValueFromJob(job),
    sessionTarget: job.sessionTarget ?? (payloadKind === "agentTurn" ? "isolated" : "main"),
    wakeMode: job.wakeMode ?? "now",
    payloadKind,
    payloadValue: payloadValueFromJob(job),
    agentId: job.agentId ?? "",
    description: job.description ?? "",
    enabled: job.enabled,
  };
}

function cronInputFromDraft(draft: CronDraft): DeckGoCronJobInput {
  const input: DeckGoCronJobInput = {
    name: draft.name,
    schedule: scheduleFromDraft(draft),
    sessionTarget: draft.sessionTarget,
    wakeMode: draft.wakeMode,
    payload:
      draft.payloadKind === "agentTurn"
        ? { kind: "agentTurn", message: draft.payloadValue }
        : { kind: "systemEvent", text: draft.payloadValue },
    description: draft.description,
    enabled: draft.enabled,
  };
  const agentId = draft.agentId.trim();
  if (agentId) {
    input.agentId = agentId;
  }
  return input;
}

export function CronPanel() {
  const [jobs, setJobs] = useState<DeckGoCronJob[]>([]);
  const [status, setStatus] = useState<DeckGoCronStatus | null>(null);
  const [runsResponse, setRunsResponse] = useState<DeckGoCronRunsResponse | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    "idle" | "creating" | "updating" | "running" | "deleting"
  >("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredJobId?: string) => {
    setLoadState("loading");
    try {
      const [jobsResponse, nextStatus] = await Promise.all([
        fetchCronJobs(CRON_JOBS_QUERY),
        fetchCronStatus(),
      ]);
      const nextJobs = jobsResponse.jobs ?? [];
      setJobs(nextJobs);
      setStatus(nextStatus);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredJobId?.trim() || nextJobs[0]?.id || "";
      const nextSelected =
        fallbackId && nextJobs.some((job) => job.id === fallbackId)
          ? fallbackId
          : selectedJobId && nextJobs.some((job) => job.id === selectedJobId)
            ? selectedJobId
            : nextJobs[0]?.id || "";
      setSelectedJobId(nextSelected);
      if (nextSelected) {
        const nextRuns = await fetchCronRuns(nextSelected, CRON_RUNS_QUERY);
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
    void fetchCronRuns(selectedJobId, CRON_RUNS_QUERY)
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

  const createAction = async () => {
    setActionState("creating");
    try {
      const result = await createCronJob(cronInputFromDraft(draft));
      setActionResult(result);
      setError("");
      setDraft(DEFAULT_DRAFT);
      await refresh(result.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "cron create failed");
    } finally {
      setActionState("idle");
    }
  };

  const updateSelectedAction = async () => {
    if (!selectedJob) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateCronJob(selectedJob.id, cronInputFromDraft(draft));
      setActionResult(result);
      setError("");
      await refresh(selectedJob.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "cron update failed");
    } finally {
      setActionState("idle");
    }
  };

  const runAction = async () => {
    if (!selectedJob) {
      return;
    }
    setActionState("running");
    try {
      const result = await runCronJob(selectedJob.id, { mode: "force" });
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
    if (!window.confirm(`Delete cron job ${selectedJob.id}?`)) {
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
    <section className="deckgo-panel-workspace deck-ui-cron">
      <div className="deckgo-column deck-ui-cron-column">
        <article className="deckgo-card is-float deck-ui-cron-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Cron jobs</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Scheduler inventory, status, run history, templates, and manual run/delete actions use
            the current cron routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-cron-body">
            <div className="deckgo-pill-row deck-ui-cron-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Cron {loadState}
              </span>
              <span className="deckgo-pill">running: {status?.running ? "yes" : "no"}</span>
              <span className="deckgo-pill">jobs: {status?.jobCount ?? jobs.length}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-cron-stats">
              <ShellStat label="jobs" value={jobs.length} />
              <ShellStat label="enabled" value={enabledCount} />
              <ShellStat
                label="next run"
                value={status?.nextRunAtMs ? new Date(status.nextRunAtMs).toLocaleString() : "n/a"}
              />
            </div>
            <div className="deckgo-surface-tile deck-ui-cron-surface">
              <p className="deckgo-surface-label">Create/edit job</p>
              <div className="deckgo-pill-row deck-ui-cron-template-row">
                {CRON_TEMPLATES.map((template) => (
                  <button
                    key={template.key}
                    className="deckgo-button deck-ui-cron-button"
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        scheduleKind: "cron",
                        scheduleValue: template.expr,
                      }))
                    }
                  >
                    {template.label}
                  </button>
                ))}
              </div>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-cron-form-grid">
                <input
                  aria-label="cron job name"
                  className="deckgo-input deck-ui-cron-input"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="name"
                />
                <select
                  className="deckgo-input deck-ui-cron-input"
                  value={draft.scheduleKind}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      scheduleKind: event.target.value as CronScheduleKind,
                    }))
                  }
                >
                  <option value="cron">cron</option>
                  <option value="every">every</option>
                  <option value="at">at</option>
                </select>
                <input
                  aria-label="cron schedule value"
                  className="deckgo-input deck-ui-cron-input"
                  value={draft.scheduleValue}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, scheduleValue: event.target.value }))
                  }
                  placeholder="cron expr, every ms, or ISO time"
                />
                <select
                  className="deckgo-input deck-ui-cron-input"
                  value={draft.sessionTarget}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, sessionTarget: event.target.value }))
                  }
                >
                  <option value="main">main</option>
                  <option value="isolated">isolated</option>
                  <option value="current">current</option>
                </select>
                <select
                  className="deckgo-input deck-ui-cron-input"
                  value={draft.wakeMode}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, wakeMode: event.target.value }))
                  }
                >
                  <option value="now">now</option>
                  <option value="next-heartbeat">next-heartbeat</option>
                </select>
                <select
                  className="deckgo-input deck-ui-cron-input"
                  value={draft.payloadKind}
                  onChange={(event) => {
                    const payloadKind = event.target.value as CronPayloadKind;
                    setDraft((current) => ({
                      ...current,
                      payloadKind,
                      sessionTarget: payloadKind === "agentTurn" ? "isolated" : "main",
                    }));
                  }}
                >
                  <option value="systemEvent">systemEvent</option>
                  <option value="agentTurn">agentTurn</option>
                </select>
                <input
                  className="deckgo-input deck-ui-cron-input"
                  value={draft.agentId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, agentId: event.target.value }))
                  }
                  placeholder="agent id"
                />
              </div>
              <textarea
                className="deckgo-input deck-ui-cron-input deck-ui-cron-textarea"
                value={draft.payloadValue}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, payloadValue: event.target.value }))
                }
                placeholder={draft.payloadKind === "agentTurn" ? "agent message" : "system event"}
                rows={3}
              />
              <textarea
                className="deckgo-input deck-ui-cron-input deck-ui-cron-textarea"
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="description"
                rows={2}
              />
              <label className="deckgo-label">
                <span>Job enabled</span>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
              </label>
              <div className="deckgo-actions deck-ui-cron-actions deck-ui-cron-actions-offset">
                <button
                  className="deckgo-button deck-ui-cron-button is-primary"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create job"}
                </button>
                <button
                  className="deckgo-button deck-ui-cron-button"
                  type="button"
                  onClick={() => selectedJob && setDraft(draftFromJob(selectedJob))}
                  disabled={!selectedJob || actionState !== "idle"}
                >
                  Load selected
                </button>
                <button
                  className="deckgo-button deck-ui-cron-button"
                  type="button"
                  onClick={() => void updateSelectedAction()}
                  disabled={!selectedJob || actionState !== "idle"}
                >
                  {actionState === "updating" ? "Saving" : "Save selected"}
                </button>
              </div>
            </div>
            <div className="deckgo-actions deck-ui-cron-actions">
              <button
                className="deckgo-button deck-ui-cron-button"
                type="button"
                onClick={() => void refresh(selectedJobId)}
              >
                Refresh cron
              </button>
              <button
                className="deckgo-button deck-ui-cron-button is-primary"
                type="button"
                onClick={() => void runAction()}
                disabled={!selectedJob || actionState !== "idle"}
              >
                {actionState === "running" ? "Running" : "Run now"}
              </button>
              <button
                className="deckgo-button deck-ui-cron-button is-danger"
                type="button"
                onClick={() => void deleteAction()}
                disabled={!selectedJob || actionState !== "idle"}
              >
                {actionState === "deleting" ? "Deleting" : "Delete"}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-cron-error">{error}</p> : null}
            {jobs.length === 0 ? (
              <p className="deckgo-note deck-ui-cron-empty">No cron jobs loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-cron-list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-cron-row ${selectedJob?.id === job.id ? "is-selected" : ""}`}
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

      <div className="deckgo-column deckgo-panel-main deck-ui-cron-column deck-ui-cron-detail-column">
        <article className="deckgo-card is-float deck-ui-cron-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected job</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Cron jobs use the current scheduler routes for inspection, edits, run history, and
            manual execution.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-cron-body">
            {selectedJob ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-cron-hero">
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
                <div className="deckgo-grid deckgo-grid-2 deck-ui-cron-detail-stats">
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
                <div className="deck-ui-cron-details">
                  <JsonDetails title="Job payload" payload={selectedJob} />
                  <JsonDetails title="Run history" payload={runs} />
                </div>
              </>
            ) : (
              <p className="deckgo-note">Choose a cron job to inspect it.</p>
            )}
            {actionResult ? (
              <div className="deck-ui-cron-details">
                <JsonDetails title="Last cron action" payload={actionResult} />
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
