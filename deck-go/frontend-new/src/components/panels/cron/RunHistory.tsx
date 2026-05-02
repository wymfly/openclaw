import type { DeckGoCronRunEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function RunHistory(props: { runs: DeckGoCronRunEntry[] }) {
  const t = useTranslations("cron");
  const formatRunDate = (value?: number) =>
    value ? new Date(value).toLocaleString() : t("notAvailable");

  if (props.runs.length === 0) {
    return <p className="deckgo-note deck-ui-cron-empty">{t("noRuns")}</p>;
  }

  return (
    <div className="deck-ui-cron-run-history">
      <table className="deck-ui-cron-table">
        <thead>
          <tr>
            <th>{t("startTime")}</th>
            <th>{t("duration")}</th>
            <th>{t("status")}</th>
          </tr>
        </thead>
        <tbody>
          {props.runs.map((run) => (
            <tr key={run.id}>
              <td>{formatRunDate(run.ts)}</td>
              <td>{run.durationMs != null ? `${run.durationMs}ms` : t("notAvailable")}</td>
              <td>
                <span
                  className={`deckgo-pill ${run.status === "ok" ? "is-positive" : run.status === "error" ? "is-danger" : "is-muted"}`}
                >
                  {t(run.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
