import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoCronJob,
  DeckGoCronRunEntry,
  DeckGoCronRunsResponse,
  DeckGoCronStatus,
} from "@/api-types";
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import {
  cronJobsQueryOptions,
  cronRunsQueryOptions,
  cronStatusQueryOptions,
  useCreateCronJobMutation,
  useDeleteCronJobMutation,
  useRunCronJobMutation,
  useUpdateCronJobMutation,
} from "../../../data/modules/cron";
import {
  KpiStrip,
  PanelPill,
  PanelRoot,
  PanelSectionHeader,
  PanelStatusRow,
  PanelSurface,
} from "../../../design-system/patterns";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import {
  cronInputFromDraft,
  CRON_TEMPLATES,
  DEFAULT_DRAFT,
  draftFromJob,
  formatCronDate,
  summarizeSchedule,
  type CronActionState,
  type CronDraft,
  type CronPayloadKind,
  type CronScheduleKind,
  type PanelState,
} from "./cron-model";
import { CronMetric } from "./CronMetric";
import { HeartbeatConfig } from "./HeartbeatConfig";
import { RunHistory } from "./RunHistory";
import "./cron-panel.css";

const CRON_JOBS_QUERY = { includeDisabled: true } as const;
const CRON_RUNS_QUERY = { limit: 20, sortDir: "desc" } as const;

type EnabledFilter = "all" | "enabled" | "disabled";
type SortKey = "nextRunAtMs" | "updatedAtMs" | "name";
type DetailTab = "overview" | "schedule" | "history" | "payload" | "scheduler";
type BuilderState =
  | { mode: "create"; draft: CronDraft }
  | { mode: "edit"; job: DeckGoCronJob; draft: CronDraft };

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatCount(value: number, total?: number) {
  return typeof total === "number" ? `${value}/${total}` : String(value);
}

function statusText(t: ReturnType<typeof useTranslations>, state: PanelState) {
  return `Cron ${t(`panelStates.${state}`)}`;
}

function compareMaybeNumber(left?: number, right?: number) {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  return left - right;
}

function sortJobs(jobs: DeckGoCronJob[], sortBy: SortKey) {
  return [...jobs].toSorted((left, right) => {
    if (sortBy === "name") {
      return left.name.localeCompare(right.name);
    }
    if (sortBy === "updatedAtMs") {
      return compareMaybeNumber(right.updatedAtMs, left.updatedAtMs);
    }
    return compareMaybeNumber(left.nextRunAtMs, right.nextRunAtMs);
  });
}

function buildSearchHaystack(job: DeckGoCronJob) {
  return normalizeText(
    [
      job.id,
      job.name,
      job.description ?? "",
      job.agentId ?? "",
      job.sessionTarget ?? "",
      summarizeSchedule(job),
    ].join(" "),
  );
}

function lastRunForJob(runs: DeckGoCronRunEntry[], jobId: string) {
  return runs.filter((run) => run.jobId === jobId).toSorted((left, right) => right.ts - left.ts)[0];
}

function CountPill(props: { value: string | number }) {
  return <span className="cron-panel__count">{props.value}</span>;
}

export function CronPanel() {
  const t = useTranslations("cron");
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const createCronJobMutation = useCreateCronJobMutation();
  const updateCronJobMutation = useUpdateCronJobMutation();
  const deleteCronJobMutation = useDeleteCronJobMutation();
  const runCronJobMutation = useRunCronJobMutation();
  const [jobs, setJobs] = useState<DeckGoCronJob[]>([]);
  const [status, setStatus] = useState<DeckGoCronStatus | null>(null);
  const [runsResponse, setRunsResponse] = useState<DeckGoCronRunsResponse | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<CronActionState>("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("nextRunAtMs");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<DeckGoCronJob | null>(null);

  const refresh = async (preferredJobId?: string) => {
    setLoadState("loading");
    try {
      const [jobsResponse, nextStatus] = await Promise.all([
        queryClient.fetchQuery({
          ...cronJobsQueryOptions(bff, CRON_JOBS_QUERY),
          staleTime: 0,
        }),
        queryClient.fetchQuery({
          ...cronStatusQueryOptions(bff),
          staleTime: 0,
        }),
      ]);
      const nextJobs = jobsResponse.jobs ?? [];
      setJobs(nextJobs);
      setStatus(nextStatus);
      setLoadState("ready");
      setError("");
      const candidateId = preferredJobId?.trim() || selectedJobId;
      const nextSelected =
        candidateId && nextJobs.some((job) => job.id === candidateId)
          ? candidateId
          : nextJobs[0]?.id || "";
      setSelectedJobId(nextSelected);
      if (nextSelected) {
        const nextRuns = await queryClient.fetchQuery({
          ...cronRunsQueryOptions(bff, nextSelected, CRON_RUNS_QUERY),
          staleTime: 0,
        });
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
    void queryClient
      .fetchQuery({
        ...cronRunsQueryOptions(bff, selectedJobId, CRON_RUNS_QUERY),
        staleTime: 0,
      })
      .then((next) => {
        setRunsResponse(next);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : t("runsLoadFailed"));
      });
  }, [bff, queryClient, selectedJobId, t]);

  const runs = runsResponse?.entries ?? [];
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const enabledCount = useMemo(() => jobs.filter((job) => job.enabled).length, [jobs]);
  const loadedErrorCount = useMemo(
    () => runs.filter((run) => run.status === "error").length,
    [runs],
  );
  const selectedLastRun = selectedJob ? lastRunForJob(runs, selectedJob.id) : undefined;

  const visibleJobs = useMemo(() => {
    const needle = normalizeText(query);
    const filtered = jobs.filter((job) => {
      if (enabledFilter === "enabled" && !job.enabled) {
        return false;
      }
      if (enabledFilter === "disabled" && job.enabled) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return buildSearchHaystack(job).includes(needle);
    });
    return sortJobs(filtered, sortBy);
  }, [enabledFilter, jobs, query, sortBy]);
  const activeCriteria = [
    query.trim() ? t("criteriaSearch", { value: query.trim() }) : "",
    enabledFilter !== "all" ? t("criteriaEnabled", { value: t(`filters.${enabledFilter}`) }) : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const saveBuilder = async () => {
    if (!builder) {
      return;
    }
    setActionState(builder.mode === "create" ? "creating" : "updating");
    try {
      const input = cronInputFromDraft(builder.draft);
      const result =
        builder.mode === "create"
          ? await createCronJobMutation.mutateAsync(input)
          : await updateCronJobMutation.mutateAsync({ input, jobId: builder.job.id });
      setActionResult(result);
      setBuilder(null);
      setError("");
      await refresh(result.id ?? (builder.mode === "edit" ? builder.job.id : undefined));
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : builder.mode === "create"
            ? t("createFailed")
            : t("updateFailed"),
      );
    } finally {
      setActionState("idle");
    }
  };

  const runAction = async () => {
    if (!selectedJob || !selectedJob.enabled) {
      return;
    }
    setActionState("running");
    try {
      const result = await runCronJobMutation.mutateAsync({
        jobId: selectedJob.id,
        params: { mode: "force" },
      });
      setActionResult(result);
      setError("");
      await refresh(selectedJob.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("runFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const toggleSelected = async () => {
    if (!selectedJob) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateCronJobMutation.mutateAsync({
        input: { enabled: !selectedJob.enabled },
        jobId: selectedJob.id,
      });
      setActionResult(result);
      setError("");
      await refresh(selectedJob.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("updateFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!deleteCandidate) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteCronJobMutation.mutateAsync(deleteCandidate.id);
      setActionResult(result);
      setDeleteCandidate(null);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <PanelRoot data-testid="cron-panel" density="compact">
      <div className="cron-panel">
        <PanelSectionHeader
          eyebrow={t("topbarEyebrow")}
          title={t("title")}
          description={
            <>
              {t("panelDescription")} {t("schedulerState")}:{" "}
              <code>{status?.running ? t("running") : t("idle")}</code> · {t("nextRun")}:{" "}
              <code>{formatCronDate(status?.nextRunAtMs)}</code>
            </>
          }
          actions={
            <PanelStatusRow align="end">
              <button
                className="cron-panel__button is-primary"
                type="button"
                onClick={() => setBuilder({ mode: "create", draft: DEFAULT_DRAFT })}
              >
                {t("addJob")}
              </button>
              <button
                className="cron-panel__button"
                type="button"
                onClick={() => void refresh(selectedJobId)}
                disabled={loadState === "loading"}
              >
                {loadState === "loading" ? t("refreshing") : t("refresh")}
              </button>
            </PanelStatusRow>
          }
        />
        <KpiStrip columns={4} aria-label={t("kpiLabel")}>
          <CronMetric label={t("totalJobs")} value={jobs.length} />
          <CronMetric
            label={t("enabledCount")}
            tone={enabledCount > 0 ? "positive" : undefined}
            value={formatCount(enabledCount, jobs.length)}
          />
          <CronMetric label={t("loadedRuns")} value={runs.length} />
          <CronMetric
            label={t("loadedErrors")}
            tone={loadedErrorCount > 0 ? "danger" : "positive"}
            value={loadedErrorCount}
          />
        </KpiStrip>

        {error ? <p className="cron-panel__banner is-danger">{error}</p> : null}

        <main className="cron-panel__main">
          <PanelSurface as="article">
            <div className="cron-panel__jobs-card">
              <PanelSectionHeader
                eyebrow={t("inventory")}
                title={t("scheduledJobs")}
                headingLevel={3}
                meta={
                  <PanelStatusRow align="end">
                    <PanelPill tone={loadState === "ready" ? "positive" : "default"}>
                      {statusText(t, loadState)}
                    </PanelPill>
                  </PanelStatusRow>
                }
              />
              <div className="cron-panel__filters">
                <div
                  className="cron-panel__segmented"
                  role="tablist"
                  aria-label={t("enabledFilter")}
                >
                  {(["all", "enabled", "disabled"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      role="tab"
                      aria-selected={enabledFilter === filter}
                      className={`cron-panel__segmented-button ${enabledFilter === filter ? "is-active" : ""}`}
                      onClick={() => setEnabledFilter(filter)}
                    >
                      {t(`filters.${filter}`)}
                      <CountPill
                        value={
                          filter === "all"
                            ? jobs.length
                            : jobs.filter((job) => job.enabled === (filter === "enabled")).length
                        }
                      />
                    </button>
                  ))}
                </div>
                <label className="cron-panel__search">
                  <span>{t("search")}</span>
                  <input
                    className="cron-panel__input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("searchPlaceholder")}
                  />
                </label>
                <label className="cron-panel__sort">
                  <span>{t("sortLabel")}</span>
                  <select
                    className="cron-panel__select"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortKey)}
                  >
                    <option value="nextRunAtMs">{t("sort.nextRunAtMs")}</option>
                    <option value="updatedAtMs">{t("sort.updatedAtMs")}</option>
                    <option value="name">{t("sort.name")}</option>
                  </select>
                </label>
              </div>
              <div className="cron-panel__table" role="table" aria-label={t("scheduledJobs")}>
                <div className="cron-panel__table-head" role="row">
                  <span role="columnheader">{t("job")}</span>
                  <span role="columnheader">{t("schedule")}</span>
                  <span role="columnheader">{t("nextRun")}</span>
                  <span role="columnheader">{t("lastRun")}</span>
                  <span role="columnheader">{t("target")}</span>
                  <span role="columnheader">{t("state")}</span>
                </div>
                {visibleJobs.length === 0 ? (
                  <div className="cron-panel__empty">
                    <p>{jobs.length === 0 ? t("noJobs") : t("noMatches")}</p>
                    {jobs.length > 0 ? <p>{activeCriteria}</p> : null}
                    {jobs.length > 0 ? (
                      <button
                        className="cron-panel__button"
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setEnabledFilter("all");
                        }}
                      >
                        {t("clearFilters")}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  visibleJobs.map((job) => {
                    const rowLastRun = selectedJobId === job.id ? selectedLastRun : undefined;
                    return (
                      <button
                        key={job.id}
                        type="button"
                        role="row"
                        aria-selected={selectedJobId === job.id}
                        className={`cron-panel__job-row ${selectedJobId === job.id ? "is-selected" : ""} ${!job.enabled ? "is-disabled" : ""}`}
                        onClick={() => {
                          setSelectedJobId(job.id);
                          setDetailTab("overview");
                        }}
                      >
                        <span role="cell" className="cron-panel__job-name">
                          <strong>{job.name}</strong>
                          <code>{job.id}</code>
                        </span>
                        <span role="cell">{summarizeSchedule(job)}</span>
                        <span role="cell">
                          {job.enabled ? formatCronDate(job.nextRunAtMs) : t("disabled")}
                        </span>
                        <span role="cell">{rowLastRun ? t(rowLastRun.status) : t("never")}</span>
                        <span role="cell">{job.sessionTarget || t("notAvailable")}</span>
                        <span role="cell">
                          <PanelPill tone={job.enabled ? "positive" : "default"}>
                            {job.enabled ? t("enabled") : t("disabled")}
                          </PanelPill>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </PanelSurface>

          <PanelSurface as="article">
            <div className="cron-panel__detail-card">
              {selectedJob ? (
                <CronJobDetail
                  actionResult={actionResult}
                  actionState={actionState}
                  detailTab={detailTab}
                  job={selectedJob}
                  lastRun={selectedLastRun}
                  runs={runs}
                  status={status}
                  setDetailTab={setDetailTab}
                  onDelete={() => setDeleteCandidate(selectedJob)}
                  onEdit={() =>
                    setBuilder({ mode: "edit", job: selectedJob, draft: draftFromJob(selectedJob) })
                  }
                  onRun={() => void runAction()}
                  onToggle={() => void toggleSelected()}
                />
              ) : (
                <div className="cron-panel__empty-state">
                  <p className="cron-panel__eyebrow">{t("selectedJob")}</p>
                  <h3 className="cron-panel__dialog-title">{t("selectJobHint")}</h3>
                  <p className="cron-panel__description">{t("emptyDetailDescription")}</p>
                </div>
              )}
            </div>
          </PanelSurface>
        </main>

        {builder ? (
          <CronBuilderDialog
            actionState={actionState}
            builder={builder}
            setBuilder={setBuilder}
            onClose={() => setBuilder(null)}
            onSave={() => void saveBuilder()}
          />
        ) : null}

        {deleteCandidate ? (
          <DeleteConfirmDialog
            actionState={actionState}
            job={deleteCandidate}
            onCancel={() => setDeleteCandidate(null)}
            onConfirm={() => void deleteAction()}
          />
        ) : null}
      </div>
    </PanelRoot>
  );
}

function CronJobDetail(props: {
  actionResult: unknown;
  actionState: CronActionState;
  detailTab: DetailTab;
  job: DeckGoCronJob;
  lastRun?: DeckGoCronRunEntry;
  runs: DeckGoCronRunEntry[];
  status: DeckGoCronStatus | null;
  setDetailTab: (tab: DetailTab) => void;
  onDelete: () => void;
  onEdit: () => void;
  onRun: () => void;
  onToggle: () => void;
}) {
  const t = useTranslations("cron");

  return (
    <>
      <PanelSurface tone="elevated">
        <PanelSectionHeader
          eyebrow={t("selectedJob")}
          title={props.job.name}
          headingLevel={3}
          description={props.job.description || t("noDescription")}
          meta={
            <PanelStatusRow>
              <PanelPill tone={props.job.enabled ? "positive" : "default"}>
                {props.job.enabled ? t("enabled") : t("disabled")}
              </PanelPill>
              {props.job.failureAlert ? (
                <PanelPill tone="warning">{t("failureAlerts")}</PanelPill>
              ) : null}
              <PanelPill>{props.job.id}</PanelPill>
            </PanelStatusRow>
          }
          actions={
            <div className="cron-panel__detail-actions">
              <button
                className="cron-panel__button is-primary"
                type="button"
                onClick={props.onRun}
                disabled={!props.job.enabled || props.actionState !== "idle"}
              >
                {props.actionState === "running" ? t("running") : t("runNow")}
              </button>
              <button
                className="cron-panel__button"
                type="button"
                onClick={props.onToggle}
                disabled={props.actionState !== "idle"}
              >
                {props.job.enabled ? t("disableJob") : t("enableJob")}
              </button>
              <button
                className="cron-panel__button"
                type="button"
                onClick={props.onEdit}
                disabled={props.actionState !== "idle"}
              >
                {t("editJob")}
              </button>
              <button
                className="cron-panel__button is-danger"
                type="button"
                onClick={props.onDelete}
                disabled={props.actionState !== "idle"}
              >
                {t("deleteJob")}
              </button>
            </div>
          }
        />
      </PanelSurface>

      <div className="cron-panel__tabs" role="tablist" aria-label={t("detailTabs")}>
        {(["overview", "schedule", "history", "payload", "scheduler"] as const).map((tab) => (
          <button
            key={tab}
            className={`cron-panel__tab ${props.detailTab === tab ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={props.detailTab === tab}
            onClick={() => props.setDetailTab(tab)}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className="cron-panel__detail-body">
        {props.detailTab === "overview" ? (
          <OverviewTab job={props.job} lastRun={props.lastRun} />
        ) : null}
        {props.detailTab === "schedule" ? <ScheduleTab job={props.job} /> : null}
        {props.detailTab === "history" ? <RunHistory runs={props.runs} /> : null}
        {props.detailTab === "payload" ? (
          <div className="cron-panel__details">
            <JsonDetails title={t("jobPayload")} payload={props.job} />
          </div>
        ) : null}
        {props.detailTab === "scheduler" ? <HeartbeatConfig status={props.status} /> : null}
      </div>

      {props.actionResult ? (
        <div className="cron-panel__details">
          <JsonDetails title={t("lastAction")} payload={props.actionResult} />
        </div>
      ) : null}
    </>
  );
}

function OverviewTab(props: { job: DeckGoCronJob; lastRun?: DeckGoCronRunEntry }) {
  const t = useTranslations("cron");
  return (
    <PanelSurface>
      <KpiStrip columns={4}>
        <CronMetric label={t("schedule")} value={props.job.schedule.kind} />
        <CronMetric label={t("nextRun")} value={formatCronDate(props.job.nextRunAtMs)} />
        <CronMetric
          label={t("lastRun")}
          value={props.lastRun ? t(props.lastRun.status) : t("never")}
        />
        <CronMetric
          label={t("duration")}
          value={
            props.lastRun?.durationMs != null ? `${props.lastRun.durationMs}ms` : t("notAvailable")
          }
        />
      </KpiStrip>
      <dl className="cron-panel__kv">
        <div>
          <dt>{t("agentId")}</dt>
          <dd>{props.job.agentId || t("notAvailable")}</dd>
        </div>
        <div>
          <dt>{t("sessionTarget")}</dt>
          <dd>{props.job.sessionTarget || t("notAvailable")}</dd>
        </div>
        <div>
          <dt>{t("wakeMode")}</dt>
          <dd>{props.job.wakeMode || t("notAvailable")}</dd>
        </div>
        <div>
          <dt>{t("createdAt")}</dt>
          <dd>{formatCronDate(props.job.createdAtMs)}</dd>
        </div>
        <div>
          <dt>{t("updatedAt")}</dt>
          <dd>{formatCronDate(props.job.updatedAtMs)}</dd>
        </div>
        <div>
          <dt>{t("deleteAfterRun")}</dt>
          <dd>{props.job.deleteAfterRun ? t("yes") : t("no")}</dd>
        </div>
      </dl>
    </PanelSurface>
  );
}

function ScheduleTab(props: { job: DeckGoCronJob }) {
  const t = useTranslations("cron");
  const schedule = props.job.schedule;
  return (
    <PanelSurface>
      <dl className="cron-panel__kv">
        <div>
          <dt>{t("scheduleKind")}</dt>
          <dd>{t(`scheduleKinds.${schedule.kind}`)}</dd>
        </div>
        {schedule.kind === "cron" ? (
          <>
            <div>
              <dt>{t("scheduleExpression")}</dt>
              <dd>
                <code>{schedule.expr || t("notAvailable")}</code>
              </dd>
            </div>
            <div>
              <dt>{t("timezone")}</dt>
              <dd>{schedule.tz || "UTC"}</dd>
            </div>
          </>
        ) : null}
        {schedule.kind === "every" ? (
          <>
            <div>
              <dt>{t("intervalMs")}</dt>
              <dd>{schedule.everyMs ?? t("notAvailable")}</dd>
            </div>
            <div>
              <dt>{t("staggerMs")}</dt>
              <dd>{schedule.staggerMs ?? t("notAvailable")}</dd>
            </div>
          </>
        ) : null}
        {schedule.kind === "at" ? (
          <div>
            <dt>{t("oneShotAt")}</dt>
            <dd>{schedule.at || t("notAvailable")}</dd>
          </div>
        ) : null}
      </dl>
      <p className="cron-panel__note">{t("previewUnsupported")}</p>
    </PanelSurface>
  );
}

function CronBuilderDialog(props: {
  actionState: CronActionState;
  builder: BuilderState;
  setBuilder: (builder: BuilderState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("cron");
  const draft = props.builder.draft;
  const updateDraft = (next: Partial<CronDraft>) => {
    props.setBuilder({ ...props.builder, draft: { ...draft, ...next } } as BuilderState);
  };

  return (
    <div className="cron-panel__modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section
        className="cron-panel__modal"
        role="dialog"
        aria-modal="true"
        aria-label={
          props.builder.mode === "create" ? t("builderCreateTitle") : t("builderEditTitle")
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="cron-panel__modal-head">
          <div>
            <p className="cron-panel__eyebrow">{t("builderEyebrow")}</p>
            <h3 className="cron-panel__dialog-title">
              {props.builder.mode === "create" ? t("builderCreateTitle") : t("builderEditTitle")}
            </h3>
          </div>
          <button className="cron-panel__button" type="button" onClick={props.onClose}>
            {t("closeDialog")}
          </button>
        </div>

        <div className="cron-panel__builder">
          <label className="cron-panel__field">
            <span>{t("name")}</span>
            <input
              aria-label={t("name")}
              className="cron-panel__input"
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder={t("name")}
            />
          </label>
          <label className="cron-panel__field">
            <span>{t("schedule")}</span>
            <select
              aria-label={t("schedule")}
              className="cron-panel__select"
              value={draft.scheduleKind}
              onChange={(event) =>
                updateDraft({ scheduleKind: event.target.value as CronScheduleKind })
              }
            >
              <option value="cron">{t("scheduleKinds.cron")}</option>
              <option value="every">{t("scheduleKinds.every")}</option>
              <option value="at">{t("scheduleKinds.at")}</option>
            </select>
          </label>
          <label className="cron-panel__field">
            <span>{t("scheduleValue")}</span>
            <input
              aria-label={t("scheduleValue")}
              className="cron-panel__input"
              value={draft.scheduleValue}
              onChange={(event) => updateDraft({ scheduleValue: event.target.value })}
              placeholder={t("schedulePlaceholder")}
            />
          </label>
          <div className="cron-panel__template-row">
            {CRON_TEMPLATES.map((template) => (
              <button
                key={template.key}
                className="cron-panel__button"
                type="button"
                onClick={() => updateDraft({ scheduleKind: "cron", scheduleValue: template.expr })}
              >
                {t(`templates.${template.key}`)}
              </button>
            ))}
          </div>
          <label className="cron-panel__field">
            <span>{t("sessionTarget")}</span>
            <select
              aria-label={t("sessionTarget")}
              className="cron-panel__select"
              value={draft.sessionTarget}
              onChange={(event) => updateDraft({ sessionTarget: event.target.value })}
            >
              <option value="main">{t("main")}</option>
              <option value="isolated">{t("isolated")}</option>
              <option value="current">{t("current")}</option>
            </select>
          </label>
          <label className="cron-panel__field">
            <span>{t("wakeMode")}</span>
            <select
              aria-label={t("wakeMode")}
              className="cron-panel__select"
              value={draft.wakeMode}
              onChange={(event) => updateDraft({ wakeMode: event.target.value })}
            >
              <option value="now">{t("now")}</option>
              <option value="next-heartbeat">{t("nextHeartbeat")}</option>
            </select>
          </label>
          <label className="cron-panel__field">
            <span>{t("payloadType")}</span>
            <select
              aria-label={t("payloadType")}
              className="cron-panel__select"
              value={draft.payloadKind}
              onChange={(event) => {
                const payloadKind = event.target.value as CronPayloadKind;
                updateDraft({
                  payloadKind,
                  sessionTarget: payloadKind === "agentTurn" ? "isolated" : "main",
                });
              }}
            >
              <option value="systemEvent">{t("payloadKinds.systemEvent")}</option>
              <option value="agentTurn">{t("payloadKinds.agentTurn")}</option>
            </select>
          </label>
          <label className="cron-panel__field">
            <span>{t("agentId")}</span>
            <input
              className="cron-panel__input"
              value={draft.agentId}
              onChange={(event) => updateDraft({ agentId: event.target.value })}
              placeholder={t("agentId")}
            />
          </label>
          <label className="cron-panel__field is-wide">
            <span>{t("payloadValue")}</span>
            <textarea
              className="cron-panel__textarea"
              value={draft.payloadValue}
              onChange={(event) => updateDraft({ payloadValue: event.target.value })}
              placeholder={
                draft.payloadKind === "agentTurn"
                  ? t("agentMessagePlaceholder")
                  : t("eventNamePlaceholder")
              }
              rows={3}
            />
          </label>
          <label className="cron-panel__field is-wide">
            <span>{t("description")}</span>
            <textarea
              className="cron-panel__textarea"
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
              placeholder={t("description")}
              rows={2}
            />
          </label>
          <label className="cron-panel__checkbox-row">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => updateDraft({ enabled: event.target.checked })}
            />
            <span>{t("enabled")}</span>
          </label>
          <p className="cron-panel__note is-wide">{t("builderLimitations")}</p>
        </div>

        <div className="cron-panel__modal-foot">
          <button className="cron-panel__button" type="button" onClick={props.onClose}>
            {t("cancel")}
          </button>
          <button
            className="cron-panel__button is-primary"
            type="button"
            onClick={props.onSave}
            disabled={props.actionState !== "idle"}
          >
            {props.actionState === "creating" || props.actionState === "updating"
              ? t("saving")
              : props.builder.mode === "create"
                ? t("createJob")
                : t("saveSelected")}
          </button>
        </div>
      </section>
    </div>
  );
}

function DeleteConfirmDialog(props: {
  actionState: CronActionState;
  job: DeckGoCronJob;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("cron");
  return (
    <div className="cron-panel__modal-backdrop" role="presentation" onMouseDown={props.onCancel}>
      <section
        className="cron-panel__confirm"
        role="dialog"
        aria-modal="true"
        aria-label={t("deleteTitle")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="cron-panel__modal-head">
          <div>
            <p className="cron-panel__eyebrow">{t("deleteJob")}</p>
            <h3 className="cron-panel__dialog-title">{t("deleteTitle")}</h3>
          </div>
        </div>
        <p className="cron-panel__description">
          {t("deleteDescription", { name: props.job.name })}
        </p>
        <p className="cron-panel__note">
          {t("job")}: <code>{props.job.id}</code>
        </p>
        <div className="cron-panel__modal-foot">
          <button className="cron-panel__button" type="button" onClick={props.onCancel}>
            {t("cancel")}
          </button>
          <button
            className="cron-panel__button is-danger"
            type="button"
            onClick={props.onConfirm}
            disabled={props.actionState !== "idle"}
          >
            {props.actionState === "deleting" ? t("deleting") : t("deleteJob")}
          </button>
        </div>
      </section>
    </div>
  );
}
