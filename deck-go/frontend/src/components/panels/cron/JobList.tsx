import type { DeckGoCronJob, DeckGoCronStatus } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import { formatCronDate, summarizeSchedule, type PanelState } from "./cron-model";

export function JobList(props: {
  jobs: DeckGoCronJob[];
  status: DeckGoCronStatus | null;
  selectedJobId: string;
  enabledCount: number;
  loadState: PanelState;
  onCreateNew: () => void;
  onSelect: (jobId: string) => void;
}) {
  const t = useTranslations("cron");
  const ts = useTranslations("scheduler");

  return (
    <>
      <div className="deckgo-pill-row deck-ui-cron-status-row">
        <span className={`deckgo-pill ${props.loadState === "ready" ? "is-positive" : "is-muted"}`}>
          Cron {props.loadState}
        </span>
        <span className="deckgo-pill">
          {t("running")}: {props.status?.running ? t("yes") : t("no")}
        </span>
        <span className="deckgo-pill">
          {t("jobs")}: {props.status?.jobCount ?? props.jobs.length}
        </span>
      </div>
      <div className="deckgo-grid deckgo-grid-3 deck-ui-cron-stats">
        <ShellStat label={t("jobs")} value={props.jobs.length} />
        <ShellStat label={t("enabledCount")} value={props.enabledCount} />
        <ShellStat label={t("nextRun")} value={formatCronDate(props.status?.nextRunAtMs)} />
      </div>
      <button
        className="deckgo-button deck-ui-cron-button is-primary deck-ui-cron-new-button"
        type="button"
        onClick={props.onCreateNew}
      >
        {t("addJob")}
      </button>
      {props.jobs.length === 0 ? (
        <p className="deckgo-note deck-ui-cron-empty">{t("noJobs")}</p>
      ) : (
        <ul className="deckgo-shell-list deck-ui-cron-list">
          {props.jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                className={`deckgo-selectable-card deck-ui-cron-row ${props.selectedJobId === job.id ? "is-selected" : ""}`}
                onClick={() => props.onSelect(job.id)}
              >
                <strong>{job.name}</strong>
                <div className="deckgo-meta">
                  {t("schedule")}: {summarizeSchedule(job)} | {t("status")}:{" "}
                  {job.enabled ? t("enabled") : t("disabled")}
                </div>
                <div className="deckgo-meta">
                  {ts("nextExecution")}: {formatCronDate(job.nextRunAtMs)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
