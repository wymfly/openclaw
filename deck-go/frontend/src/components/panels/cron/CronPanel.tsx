import { useEffect, useMemo, useState } from "react";
import type { DeckGoCronJob, DeckGoCronRunsResponse, DeckGoCronStatus } from "../../../api";
import {
  createCronJob,
  deleteCronJob,
  fetchCronJobs,
  fetchCronRuns,
  fetchCronStatus,
  runCronJob,
  updateCronJob,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import {
  cronInputFromDraft,
  DEFAULT_DRAFT,
  draftFromJob,
  formatCronDate,
  summarizeSchedule,
  type CronActionState,
  type CronDraft,
  type PanelState,
} from "./cron-model";
import { HeartbeatConfig } from "./HeartbeatConfig";
import { JobForm } from "./JobForm";
import { JobList } from "./JobList";
import { RunHistory } from "./RunHistory";
import { RunNowButton } from "./RunNowButton";

const CRON_JOBS_QUERY = { includeDisabled: true } as const;
const CRON_RUNS_QUERY = { limit: 20, sortDir: "desc" } as const;

export function CronPanel() {
  const t = useTranslations("cron");
  const ts = useTranslations("scheduler");
  const [jobs, setJobs] = useState<DeckGoCronJob[]>([]);
  const [status, setStatus] = useState<DeckGoCronStatus | null>(null);
  const [runsResponse, setRunsResponse] = useState<DeckGoCronRunsResponse | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<CronActionState>("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [detailTab, setDetailTab] = useState<"configuration" | "history" | "heartbeat">(
    "configuration",
  );

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
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
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
        setError(loadError instanceof Error ? loadError.message : t("runsLoadFailed"));
      });
  }, [selectedJobId, t]);

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
      setError(actionError instanceof Error ? actionError.message : t("createFailed"));
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
      setError(actionError instanceof Error ? actionError.message : t("updateFailed"));
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
      setError(actionError instanceof Error ? actionError.message : t("runFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedJob) {
      return;
    }
    if (!window.confirm(t("confirmDeleteJob", { id: selectedJob.id }))) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteCronJob(selectedJob.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-cron">
      <div className="deckgo-column deck-ui-cron-column">
        <article className="deckgo-card is-float deck-ui-cron-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("title")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("panelDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-cron-body">
            <JobList
              jobs={jobs}
              status={status}
              selectedJobId={selectedJobId}
              enabledCount={enabledCount}
              loadState={loadState}
              onCreateNew={() => {
                setDraft(DEFAULT_DRAFT);
                setDetailTab("configuration");
              }}
              onSelect={setSelectedJobId}
            />
            <JobForm
              draft={draft}
              selectedJob={selectedJob}
              actionState={actionState}
              setDraft={setDraft}
              onCreate={() => void createAction()}
              onLoadSelected={() => selectedJob && setDraft(draftFromJob(selectedJob))}
              onUpdateSelected={() => void updateSelectedAction()}
            />
            <div className="deckgo-actions deck-ui-cron-actions">
              <button
                className="deckgo-button deck-ui-cron-button"
                type="button"
                onClick={() => void refresh(selectedJobId)}
              >
                {t("refresh")}
              </button>
              <RunNowButton
                disabled={!selectedJob}
                actionState={actionState}
                onRun={() => void runAction()}
              />
              <button
                className="deckgo-button deck-ui-cron-button is-danger"
                type="button"
                onClick={() => void deleteAction()}
                disabled={!selectedJob || actionState !== "idle"}
              >
                {actionState === "deleting" ? t("deleting") : t("deleteJob")}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-cron-error">{error}</p> : null}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-cron-column deck-ui-cron-detail-column">
        <article className="deckgo-card is-float deck-ui-cron-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("selectedJob")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("selectedDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-cron-body">
            <div className="deckgo-pill-row deck-ui-cron-template-row" role="tablist">
              {(["configuration", "history", "heartbeat"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`deckgo-button deck-ui-cron-button ${detailTab === tab ? "is-primary" : ""}`}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                >
                  {tab === "history"
                    ? t("runHistory")
                    : tab === "heartbeat"
                      ? ts("heartbeat")
                      : t("configuration")}
                </button>
              ))}
            </div>
            {selectedJob && detailTab !== "heartbeat" ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-cron-hero">
                  <div>
                    <p className="deckgo-kicker">{t("job")}</p>
                    <strong>{selectedJob.name}</strong>
                    <p className="deckgo-note">{selectedJob.description || t("noDescription")}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {selectedJob.enabled ? t("enabled") : t("disabled")}
                    </span>
                    <span className="deckgo-pill">{summarizeSchedule(selectedJob)}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-cron-detail-stats">
                  <ShellStat
                    label={t("agentId")}
                    value={selectedJob.agentId || t("notAvailable")}
                  />
                  <ShellStat label={t("nextRun")} value={formatCronDate(selectedJob.nextRunAtMs)} />
                </div>
                {detailTab === "history" ? (
                  <RunHistory runs={runs} />
                ) : (
                  <div className="deck-ui-cron-details">
                    <JsonDetails title={t("jobPayload")} payload={selectedJob} />
                  </div>
                )}
              </>
            ) : detailTab === "heartbeat" ? (
              <HeartbeatConfig status={status} />
            ) : (
              <p className="deckgo-note">{t("selectJobHint")}</p>
            )}
            {actionResult ? (
              <div className="deck-ui-cron-details">
                <JsonDetails title={t("lastAction")} payload={actionResult} />
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
