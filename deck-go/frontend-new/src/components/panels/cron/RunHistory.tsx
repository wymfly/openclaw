import type { DeckGoCronRunEntry } from "../../../api";
import { PanelPill, PanelSurface, type PanelPillTone } from "../../../design-system/patterns";
import { useTranslations } from "../../../i18n/provider";

function toneForRunStatus(status: DeckGoCronRunEntry["status"]): PanelPillTone {
  if (status === "ok") {
    return "positive";
  }
  if (status === "error") {
    return "danger";
  }
  return "default";
}

export function RunHistory(props: { runs: DeckGoCronRunEntry[] }) {
  const t = useTranslations("cron");
  const formatRunDate = (value?: number) =>
    value ? new Date(value).toLocaleString() : t("notAvailable");

  if (props.runs.length === 0) {
    return <p className="cron-panel__note">{t("noRuns")}</p>;
  }

  return (
    <PanelSurface>
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
              <PanelPill tone={toneForRunStatus(run.status)}>{t(run.status)}</PanelPill>
            </div>
          </li>
        ))}
      </ul>
    </PanelSurface>
  );
}
