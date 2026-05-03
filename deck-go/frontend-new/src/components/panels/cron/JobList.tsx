import type { DeckGoCronJob, DeckGoCronStatus } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { formatCronDate, summarizeSchedule, type PanelState } from "./cron-model";
import { CronMetric } from "./CronMetric";

export function JobList(props: {
  jobs: DeckGoCronJob[];
  status: DeckGoCronStatus | null;
  selectedJobId: string;
  enabledCount: number;
  loadState: PanelState;
  onSelect: (jobId: string) => void;
}) {
  const t = useTranslations("cron");
  const ts = useTranslations("scheduler");

  return (
    <>
      <div className="cron-panel__pill-row">
        <span className={`cron-panel__pill ${props.loadState === "ready" ? "is-positive" : ""}`}>
          Cron {props.loadState}
        </span>
        <span className="cron-panel__pill">
          {t("running")}: {props.status?.running ? t("yes") : t("no")}
        </span>
        <span className="cron-panel__pill">
          {t("jobs")}: {props.status?.jobCount ?? props.jobs.length}
        </span>
      </div>
      <div className="cron-panel__metrics">
        <CronMetric label={t("jobs")} value={props.jobs.length} />
        <CronMetric
          label={t("enabledCount")}
          tone={props.enabledCount > 0 ? "positive" : undefined}
          value={props.enabledCount}
        />
        <CronMetric label={t("nextRun")} value={formatCronDate(props.status?.nextRunAtMs)} />
      </div>
      {props.jobs.length === 0 ? (
        <p className="cron-panel__note">{t("noJobs")}</p>
      ) : (
        <ul className="cron-panel__list">
          {props.jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                className={`cron-panel__row ${props.selectedJobId === job.id ? "is-selected" : ""}`}
                onClick={() => props.onSelect(job.id)}
              >
                <div>
                  <strong>{job.name}</strong>
                  <p className="cron-panel__meta">
                    {t("schedule")}: {summarizeSchedule(job)} | {t("status")}:{" "}
                    {job.enabled ? t("enabled") : t("disabled")}
                  </p>
                  <p className="cron-panel__meta">
                    {ts("nextExecution")}: {formatCronDate(job.nextRunAtMs)}
                  </p>
                </div>
                <span className={`cron-panel__pill ${job.enabled ? "is-positive" : ""}`}>
                  {job.enabled ? t("enabled") : t("disabled")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
