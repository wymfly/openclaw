import type { DeckGoCronRunEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function RunHistory(props: { runs: DeckGoCronRunEntry[] }) {
  const t = useTranslations("cron");
  const formatRunDate = (value?: number) =>
    value ? new Date(value).toLocaleString() : t("notAvailable");

  if (props.runs.length === 0) {
    return <p className="cron-panel__note">{t("noRuns")}</p>;
  }

  return (
    <div className="cron-panel__surface cron-panel__run-history">
      <p className="cron-panel__label">{t("runHistory")}</p>
      <ul className="cron-panel__list">
        {props.runs.map((run, index) => (
          <li key={run.id || `${run.jobId}-${run.ts}-${index}`}>
            <div className="cron-panel__run-row">
              <div>
                <strong>{t(run.status)}</strong>
                <p className="cron-panel__meta">
                  {t("startTime")}: {formatRunDate(run.ts)} | {t("duration")}:{" "}
                  {run.durationMs != null ? `${run.durationMs}ms` : t("notAvailable")}
                </p>
              </div>
              <span
                className={`cron-panel__pill ${run.status === "ok" ? "is-positive" : run.status === "error" ? "is-danger" : ""}`}
              >
                {t(run.status)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
